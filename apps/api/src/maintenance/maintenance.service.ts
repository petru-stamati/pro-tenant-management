import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MaintenanceStatus } from '@pro-tenant/db';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../common/permissions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { paginate, skipTake } from '../common/pagination';
import { CreateMaintenanceRequestDto } from './dto/create-maintenance-request.dto';
import { UpdateMaintenanceRequestDto } from './dto/update-maintenance-request.dto';
import { ListMaintenanceRequestsDto } from './dto/list-maintenance-requests.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

/**
 * The manual transitions a PM can drive directly via POST .../status.
 * PENDING_OWNER_APPROVAL and the approval-driven move into IN_PROGRESS are
 * deliberately absent here — they only happen through the proposal
 * create/decide endpoints, so the approval gate can't be bypassed by a
 * generic status-setter (PRD §4.9).
 */
const MANUAL_TRANSITIONS: Partial<Record<MaintenanceStatus, MaintenanceStatus[]>> = {
  REPORTED: ['TRIAGED'],
  TRIAGED: ['PROPOSAL_CREATED'],
  IN_PROGRESS: ['REPAIRED'],
  REPAIRED: ['COMPLETED'],
};

const CANCELLABLE_FROM: MaintenanceStatus[] = [
  'REPORTED',
  'TRIAGED',
  'PROPOSAL_CREATED',
  'PENDING_OWNER_APPROVAL',
  'IN_PROGRESS',
  'REPAIRED',
];

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(user: AuthenticatedUser, query: ListMaintenanceRequestsDto) {
    const { page, pageSize, apartmentId, status } = query;
    const statusFilter = status ? { status: status as never } : {};

    if (user.roleKey === 'TENANT') {
      const where = {
        apartment: { leases: { some: { tenantId: user.tenantId ?? '__none__' } } },
        ...(apartmentId ? { apartmentId } : {}),
        ...statusFilter,
      };
      const [data, total] = await Promise.all([
        this.prisma.client.maintenanceRequest.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          ...skipTake(page, pageSize),
        }),
        this.prisma.client.maintenanceRequest.count({ where }),
      ]);
      return paginate(data, total, page, pageSize);
    }

    const allowedOwnerIds = await this.permissions.resolveAllowedOwnerIds(user);
    const scoped = this.prisma.forOwnerScope(allowedOwnerIds);
    const where = { ...(apartmentId ? { apartmentId } : {}), ...statusFilter };
    const [data, total] = await Promise.all([
      scoped.maintenanceRequest.findMany({
        where,
        include: { apartment: true, proposals: true },
        orderBy: { createdAt: 'desc' },
        ...skipTake(page, pageSize),
      }),
      scoped.maintenanceRequest.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async findOne(user: AuthenticatedUser, id: string) {
    if (user.roleKey === 'TENANT') {
      const request = await this.prisma.client.maintenanceRequest.findFirst({
        where: { id, apartment: { leases: { some: { tenantId: user.tenantId ?? '__none__' } } } },
      });
      if (!request) throw new NotFoundException('Maintenance request not found');
      return request;
    }

    const allowedOwnerIds = await this.permissions.resolveAllowedOwnerIds(user);
    const request = await this.prisma.forOwnerScope(allowedOwnerIds).maintenanceRequest.findFirst({
      where: { id },
      include: { apartment: true, proposals: true, statusEvents: { orderBy: { createdAt: 'asc' } } },
    });
    if (!request) throw new NotFoundException('Maintenance request not found');
    return request;
  }

  async create(dto: CreateMaintenanceRequestDto, reportedBy: AuthenticatedUser) {
    const apartment = await this.prisma.client.apartment.findFirst({ where: { id: dto.apartmentId } });
    if (!apartment) throw new BadRequestException('Apartment not found');

    if (reportedBy.roleKey === 'TENANT') {
      const hasLease = await this.prisma.client.lease.findFirst({
        where: { apartmentId: dto.apartmentId, tenantId: reportedBy.tenantId ?? '__none__' },
      });
      if (!hasLease) throw new ForbiddenException('You can only report issues for your own apartment');
    }

    const request = await this.prisma.client.$transaction(async (tx) => {
      const request = await tx.maintenanceRequest.create({
        data: {
          apartmentId: apartment.id,
          ownerId: apartment.ownerId,
          roomItemId: dto.roomItemId,
          title: dto.title,
          description: dto.description,
          urgent: dto.urgent ?? false,
          reportedById: reportedBy.id,
        },
      });
      await tx.maintenanceStatusEvent.create({
        data: { maintenanceRequestId: request.id, toStatus: 'REPORTED', changedById: reportedBy.id },
      });
      if (dto.roomItemId) {
        await tx.roomItem.update({
          where: { id: dto.roomItemId },
          data: { condition: 'NEEDS_ATTENTION', conditionNote: dto.title },
        });
      }
      return request;
    });
    await this.notifications.notifyRole(
      apartment.ownerId,
      'ADMIN',
      'MAINTENANCE_STATUS_CHANGED',
      `New issue reported — ${apartment.name}`,
      dto.title,
      'MaintenanceRequest',
      request.id,
    );
    return request;
  }

  async update(id: string, dto: UpdateMaintenanceRequestDto) {
    await this.assertExists(id);
    return this.prisma.client.maintenanceRequest.update({ where: { id }, data: dto });
  }

  async changeStatus(id: string, dto: ChangeStatusDto, changedBy: AuthenticatedUser) {
    const request = await this.assertExists(id);
    const allowed = MANUAL_TRANSITIONS[request.status] ?? [];
    if (!allowed.includes(dto.toStatus)) {
      throw new BadRequestException(
        `Cannot move from ${request.status} to ${dto.toStatus} directly. Allowed: ${allowed.join(', ') || 'none'}.`,
      );
    }

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const updated = await tx.maintenanceRequest.update({
        where: { id },
        data: {
          status: dto.toStatus,
          completedAt: dto.toStatus === 'COMPLETED' ? new Date() : undefined,
        },
      });
      await tx.maintenanceStatusEvent.create({
        data: { maintenanceRequestId: id, fromStatus: request.status, toStatus: dto.toStatus, note: dto.note, changedById: changedBy.id },
      });
      if (dto.toStatus === 'COMPLETED' && request.roomItemId) {
        await tx.roomItem.update({
          where: { id: request.roomItemId },
          data: { condition: 'GOOD', conditionNote: null },
        });
      }
      return updated;
    });
    if (dto.toStatus === 'COMPLETED') {
      await this.notifications.notifyRole(
        request.ownerId,
        'OWNER',
        'MAINTENANCE_COMPLETED',
        updated.title,
        'This repair has been completed.',
        'MaintenanceRequest',
        id,
      );
    }
    return updated;
  }

  async cancel(id: string, reason: string, changedBy: AuthenticatedUser) {
    const request = await this.assertExists(id);
    if (!CANCELLABLE_FROM.includes(request.status)) {
      throw new BadRequestException(`Cannot cancel a request that is already ${request.status}`);
    }

    return this.prisma.client.$transaction(async (tx) => {
      const updated = await tx.maintenanceRequest.update({
        where: { id },
        data: { status: 'CANCELLED', cancelReason: reason },
      });
      await tx.maintenanceStatusEvent.create({
        data: { maintenanceRequestId: id, fromStatus: request.status, toStatus: 'CANCELLED', note: reason, changedById: changedBy.id },
      });
      return updated;
    });
  }

  async createProposal(requestId: string, dto: CreateProposalDto, createdBy: AuthenticatedUser) {
    const request = await this.assertExists(requestId);
    if (request.status !== 'TRIAGED' && request.status !== 'PROPOSAL_CREATED') {
      throw new BadRequestException('A request must be TRIAGED before a proposal can be attached');
    }

    const proposal = await this.prisma.client.$transaction(async (tx) => {
      // A revised quote supersedes whatever was still awaiting a decision —
      // "every proposal version" stays on record, nothing is overwritten (PRD §4.9).
      await tx.maintenanceProposal.updateMany({
        where: { maintenanceRequestId: requestId, status: 'PENDING' },
        data: { status: 'SUPERSEDED' },
      });

      const version = (await tx.maintenanceProposal.count({ where: { maintenanceRequestId: requestId } })) + 1;
      const proposal = await tx.maintenanceProposal.create({
        data: {
          maintenanceRequestId: requestId,
          version,
          contractorName: dto.contractorName,
          costEUR: dto.costEUR,
          description: dto.description,
          createdById: createdBy.id,
        },
      });

      await tx.maintenanceRequest.update({ where: { id: requestId }, data: { status: 'PENDING_OWNER_APPROVAL' } });
      await tx.maintenanceStatusEvent.create({
        data: {
          maintenanceRequestId: requestId,
          fromStatus: request.status,
          toStatus: 'PENDING_OWNER_APPROVAL',
          note: `Proposal v${version} from ${dto.contractorName}`,
          changedById: createdBy.id,
        },
      });
      return proposal;
    });
    await this.notifications.notifyRole(
      request.ownerId,
      'OWNER',
      'PROPOSAL_PENDING_APPROVAL',
      request.title,
      `Quote from ${dto.contractorName} needs your approval.`,
      'MaintenanceRequest',
      requestId,
    );
    return proposal;
  }

  async decideProposal(
    requestId: string,
    proposalId: string,
    decision: 'APPROVED' | 'REJECTED',
    decidedBy: AuthenticatedUser,
  ) {
    const allowedOwnerIds = await this.permissions.resolveAllowedOwnerIds(decidedBy);
    const request = await this.prisma.forOwnerScope(allowedOwnerIds).maintenanceRequest.findFirst({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Maintenance request not found');
    if (request.status !== 'PENDING_OWNER_APPROVAL') {
      throw new BadRequestException('This request is not awaiting an approval decision');
    }

    const proposal = await this.prisma.client.maintenanceProposal.findFirst({
      where: { id: proposalId, maintenanceRequestId: requestId },
    });
    if (!proposal || proposal.status !== 'PENDING') {
      throw new BadRequestException('Proposal not found or no longer pending');
    }

    const nextRequestStatus: MaintenanceStatus = decision === 'APPROVED' ? 'IN_PROGRESS' : 'TRIAGED';

    const updated = await this.prisma.client.$transaction(async (tx) => {
      await tx.maintenanceProposal.update({
        where: { id: proposalId },
        data: { status: decision, decidedById: decidedBy.id, decidedAt: new Date() },
      });
      const updated = await tx.maintenanceRequest.update({
        where: { id: requestId },
        data: { status: nextRequestStatus },
      });
      await tx.maintenanceStatusEvent.create({
        data: {
          maintenanceRequestId: requestId,
          fromStatus: 'PENDING_OWNER_APPROVAL',
          toStatus: nextRequestStatus,
          note: `Proposal ${decision.toLowerCase()} by owner`,
          changedById: decidedBy.id,
        },
      });
      return updated;
    });
    await this.notifications.notifyRole(
      request.ownerId,
      'ADMIN',
      'PROPOSAL_DECIDED',
      updated.title,
      `The Owner ${decision.toLowerCase()} the quote.`,
      'MaintenanceRequest',
      requestId,
    );
    return updated;
  }

  async listComments(user: AuthenticatedUser, requestId: string) {
    await this.findOne(user, requestId); // enforces the same scope/404 behavior
    const where =
      user.roleKey === 'TENANT'
        ? { maintenanceRequestId: requestId, visibleToTenant: true }
        : { maintenanceRequestId: requestId };
    return this.prisma.client.maintenanceComment.findMany({ where, orderBy: { createdAt: 'asc' } });
  }

  async createComment(requestId: string, dto: CreateCommentDto, author: AuthenticatedUser) {
    await this.assertExists(requestId);
    return this.prisma.client.maintenanceComment.create({
      data: {
        maintenanceRequestId: requestId,
        proposalId: dto.proposalId,
        body: dto.body,
        visibleToTenant: dto.visibleToTenant ?? false,
        authorId: author.id,
      },
    });
  }

  private async assertExists(id: string) {
    const request = await this.prisma.client.maintenanceRequest.findFirst({ where: { id } });
    if (!request) throw new NotFoundException('Maintenance request not found');
    return request;
  }
}
