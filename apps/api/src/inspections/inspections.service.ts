import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../common/permissions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { RecordInspectionResultDto } from './dto/record-inspection-result.dto';
import { CompleteInspectionDto } from './dto/complete-inspection.dto';

const OUTCOME_PHRASE: Record<string, (note?: string | null) => string> = {
  CONFIRMED_GOOD: () => 'good',
  NEEDS_ATTENTION: (note) => note || 'needs attention',
  REPLACED: (note) => `replaced${note ? ` — ${note}` : ''}`,
  REMOVED: (note) => `removed${note ? ` — ${note}` : ''}`,
};

@Injectable()
export class InspectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(user: AuthenticatedUser, apartmentId: string) {
    const allowedOwnerIds = await this.permissions.resolveAllowedOwnerIds(user);
    const scoped = this.prisma.forOwnerScope(allowedOwnerIds);
    return scoped.inspection.findMany({
      where: { apartmentId },
      include: { results: { orderBy: { createdAt: 'asc' } }, performedBy: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const allowedOwnerIds = await this.permissions.resolveAllowedOwnerIds(user);
    const inspection = await this.prisma.forOwnerScope(allowedOwnerIds).inspection.findFirst({
      where: { id },
      include: { results: { orderBy: { createdAt: 'asc' }, include: { roomItem: true } } },
    });
    if (!inspection) throw new NotFoundException('Inspection not found');
    return inspection;
  }

  /** Resumes the apartment's already-open inspection if there is one, rather than starting a second one in parallel. */
  async startOrResume(dto: CreateInspectionDto, performedBy: AuthenticatedUser) {
    const apartment = await this.prisma.client.apartment.findFirst({ where: { id: dto.apartmentId } });
    if (!apartment) throw new BadRequestException('Apartment not found');

    const existing = await this.prisma.client.inspection.findFirst({
      where: { apartmentId: dto.apartmentId, status: 'IN_PROGRESS' },
      include: { results: true },
    });
    if (existing) return existing;

    return this.prisma.client.inspection.create({
      data: {
        apartmentId: dto.apartmentId,
        ownerId: apartment.ownerId,
        performedById: performedBy.id,
      },
      include: { results: true },
    });
  }

  async recordResult(inspectionId: string, dto: RecordInspectionResultDto) {
    const inspection = await this.assertInProgress(inspectionId);
    const item = await this.prisma.client.roomItem.findFirst({ where: { id: dto.roomItemId } });
    if (!item) throw new NotFoundException('Item not found');

    if (dto.outcome === 'NEEDS_ATTENTION' && !dto.note) {
      throw new BadRequestException('A note is required when flagging an item as needing attention');
    }
    if (dto.outcome === 'REMOVED' && !dto.note) {
      throw new BadRequestException('A reason is required when marking an item removed');
    }
    if (dto.outcome === 'REPLACED' && !dto.newName) {
      throw new BadRequestException('The new item description is required when marking an item replaced');
    }

    return this.prisma.client.$transaction(async (tx) => {
      const result = await tx.inspectionResult.create({
        data: {
          inspectionId,
          roomItemId: dto.roomItemId,
          outcome: dto.outcome,
          note: dto.note,
          previousItemName: item.name,
        },
      });

      if (dto.outcome === 'CONFIRMED_GOOD') {
        await tx.roomItem.update({ where: { id: item.id }, data: { condition: 'GOOD', conditionNote: null } });
      } else if (dto.outcome === 'NEEDS_ATTENTION') {
        await tx.roomItem.update({ where: { id: item.id }, data: { condition: 'NEEDS_ATTENTION', conditionNote: dto.note } });
      } else if (dto.outcome === 'REPLACED') {
        await tx.roomItem.update({
          where: { id: item.id },
          data: { name: dto.newName, condition: 'GOOD', conditionNote: null },
        });
      } else if (dto.outcome === 'REMOVED') {
        await tx.roomItem.update({ where: { id: item.id }, data: { deletedAt: new Date() } });
      }

      return result;
    });
  }

  async complete(id: string, dto: CompleteInspectionDto) {
    const inspection = await this.assertInProgress(id);
    const results = await this.prisma.client.inspectionResult.findMany({
      where: { inspectionId: id },
      orderBy: { createdAt: 'asc' },
    });

    const updated = await this.prisma.client.inspection.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date(), notes: dto.notes },
    });

    const apartment = await this.prisma.client.apartment.findFirst({ where: { id: inspection.apartmentId } });
    const summary =
      results.length > 0
        ? results.map((r) => `${r.previousItemName} — ${OUTCOME_PHRASE[r.outcome](r.note)}`).join('. ')
        : 'No items were checked.';

    await this.notifications.notifyRole(
      inspection.ownerId,
      'OWNER',
      'INSPECTION_COMPLETED',
      `Inspection completed — ${apartment?.name ?? ''}`,
      summary,
      'Inspection',
      id,
    );

    return updated;
  }

  private async assertInProgress(id: string) {
    const inspection = await this.prisma.client.inspection.findFirst({ where: { id } });
    if (!inspection) throw new NotFoundException('Inspection not found');
    if (inspection.status !== 'IN_PROGRESS') {
      throw new BadRequestException('This inspection is already completed');
    }
    return inspection;
  }
}
