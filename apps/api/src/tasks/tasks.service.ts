import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SystemRoleKey } from '@pro-tenant/db';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../common/permissions.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { paginate, skipTake } from '../common/pagination';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ListTasksDto } from './dto/list-tasks.dto';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  async list(user: AuthenticatedUser, query: ListTasksDto) {
    const { page, pageSize, apartmentId, status } = query;
    const allowedOwnerIds = await this.permissions.resolveAllowedOwnerIds(user);
    if (user.roleKey !== 'TENANT') await this.syncLeaseRenewalTasks(user, allowedOwnerIds);
    const scoped = this.prisma.forOwnerScope(allowedOwnerIds);
    const where = {
      ...(apartmentId ? { apartmentId } : {}),
      ...(status ? { status: status as never } : {}),
    };
    const [data, total] = await Promise.all([
      scoped.task.findMany({
        where,
        include: { apartment: true, tenant: true, createdBy: true },
        // Urgent-first, then newest — this is the "what do I need to do" inbox, not a chronological log.
        orderBy: [{ urgent: 'desc' }, { createdAt: 'desc' }],
        ...skipTake(page, pageSize),
      }),
      scoped.task.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const task = await this.scopedFind(user, id, {
      apartment: true,
      tenant: true,
      createdBy: true,
      lease: true,
      comments: { orderBy: { createdAt: 'asc' }, include: { author: true } },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  /**
   * Auto-creates a "Lease renewal" task the first time an ACTIVE, non-auto-renewing
   * lease enters its expiry window (same 60-day threshold as the Leases tab's "Expires
   * in N days" label — lib/lease-status.ts on the frontend). One task per lease, ever:
   * once created it's never duplicated, even if the PM cancels it without renewing —
   * that's a deliberate decision, tracked by leaving the task CANCELLED, not by pretending
   * it never happened. renew()/terminate() close it back out automatically.
   */
  private async syncLeaseRenewalTasks(user: AuthenticatedUser, allowedOwnerIds: string[] | 'all') {
    const scoped = this.prisma.forOwnerScope(allowedOwnerIds);
    const candidates = await scoped.lease.findMany({
      where: { status: 'ACTIVE', autoRenewal: false },
      include: { apartment: true, tenant: true },
    });

    const EXPIRY_WARNING_DAYS = 60;
    const now = new Date();
    const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    for (const lease of candidates) {
      const end = new Date(lease.endDate);
      const endMidnight = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      const daysLeft = Math.round((endMidnight.getTime() - nowMidnight.getTime()) / 86_400_000);
      if (daysLeft > EXPIRY_WARNING_DAYS) continue;

      const existing = await scoped.task.findFirst({ where: { leaseId: lease.id } });
      if (existing) continue;

      const tenantName = lease.tenant ? `${lease.tenant.firstName} ${lease.tenant.lastName}` : 'the tenant';
      const whenPhrase = daysLeft < 0 ? `expired on ${end.toISOString().slice(0, 10)}` : `expires on ${end.toISOString().slice(0, 10)}`;

      await this.prisma.client.task.create({
        data: {
          ownerId: lease.ownerId,
          apartmentId: lease.apartmentId,
          tenantId: lease.tenantId,
          leaseId: lease.id,
          title: `Lease renewal — ${lease.apartment.name}`,
          description: `The lease for ${tenantName} ${whenPhrase}. Upload the signed renewal addendum/extension, send it to the Owner to confirm, then mark this Completed to renew the lease.`,
          urgent: daysLeft < 0,
          assignedToRole: 'ADMIN',
          createdById: user.id,
        },
      });
    }
  }

  async create(dto: CreateTaskDto, createdBy: AuthenticatedUser) {
    let ownerId: string;
    let assignedToRole: SystemRoleKey;

    if (createdBy.roleKey === 'OWNER') {
      if (!createdBy.ownerId) throw new ForbiddenException('No owner company linked to this account');
      ownerId = createdBy.ownerId;
      assignedToRole = 'ADMIN'; // an Owner can only delegate to the PM
    } else {
      if (!dto.ownerId) throw new BadRequestException('ownerId is required');
      ownerId = dto.ownerId;
      assignedToRole = dto.assignedToRole ?? 'OWNER';
    }

    if (dto.apartmentId) {
      const apartment = await this.prisma.client.apartment.findFirst({ where: { id: dto.apartmentId } });
      if (!apartment) throw new BadRequestException('Apartment not found');
      if (apartment.ownerId !== ownerId) throw new BadRequestException('Apartment does not belong to this owner');
    }

    return this.prisma.client.task.create({
      data: {
        ownerId,
        apartmentId: dto.apartmentId,
        tenantId: dto.tenantId,
        title: dto.title,
        description: dto.description,
        urgent: dto.urgent ?? false,
        assignedToRole,
        createdById: createdBy.id,
      },
    });
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateTaskDto) {
    await this.assertExistsScoped(user, id);
    return this.prisma.client.task.update({ where: { id }, data: dto });
  }

  async createComment(user: AuthenticatedUser, id: string, dto: CreateTaskCommentDto) {
    await this.assertExistsScoped(user, id);
    return this.prisma.client.taskComment.create({
      data: { taskId: id, body: dto.body, authorId: user.id },
    });
  }

  private async scopedFind(user: AuthenticatedUser, id: string, include?: Record<string, unknown>) {
    const allowedOwnerIds = await this.permissions.resolveAllowedOwnerIds(user);
    return this.prisma.forOwnerScope(allowedOwnerIds).task.findFirst({ where: { id }, include: include as never });
  }

  private async assertExistsScoped(user: AuthenticatedUser, id: string) {
    const task = await this.scopedFind(user, id);
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }
}
