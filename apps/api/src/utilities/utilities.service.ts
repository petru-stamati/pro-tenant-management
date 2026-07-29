import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../common/permissions.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { paginate, skipTake } from '../common/pagination';
import { CreateUtilityRecordDto } from './dto/create-utility-record.dto';
import { UpdateUtilityRecordDto } from './dto/update-utility-record.dto';
import { ListUtilityRecordsDto } from './dto/list-utility-records.dto';

@Injectable()
export class UtilitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  async list(user: AuthenticatedUser, query: ListUtilityRecordsDto) {
    const { page, pageSize, apartmentId, utilityType } = query;
    const allowedOwnerIds = await this.permissions.resolveAllowedOwnerIds(user);
    const scoped = this.prisma.forOwnerScope(allowedOwnerIds);
    const where = {
      ...(apartmentId ? { apartmentId } : {}),
      ...(utilityType ? { utilityType: utilityType as never } : {}),
    };
    const [data, total] = await Promise.all([
      scoped.utilityRecord.findMany({
        where,
        include: { apartment: true },
        orderBy: { periodMonth: 'desc' },
        ...skipTake(page, pageSize),
      }),
      scoped.utilityRecord.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async create(dto: CreateUtilityRecordDto, recordedBy: AuthenticatedUser) {
    const apartment = await this.prisma.client.apartment.findFirst({ where: { id: dto.apartmentId } });
    if (!apartment) throw new BadRequestException('Apartment not found');

    const consumption =
      dto.previousReading !== undefined && dto.currentReading !== undefined
        ? dto.currentReading - dto.previousReading
        : undefined;

    return this.prisma.client.utilityRecord.create({
      data: {
        apartmentId: dto.apartmentId,
        ownerId: apartment.ownerId,
        leaseId: dto.leaseId,
        utilityType: dto.utilityType,
        periodMonth: new Date(dto.periodMonth),
        previousReading: dto.previousReading,
        currentReading: dto.currentReading,
        consumption,
        invoiceAmountRON: dto.invoiceAmountRON,
        recordedById: recordedBy.id,
      },
    });
  }

  async update(id: string, dto: UpdateUtilityRecordDto) {
    const existing = await this.assertExists(id);
    const previousReading = dto.previousReading ?? Number(existing.previousReading ?? 0);
    const currentReading = dto.currentReading ?? (existing.currentReading ? Number(existing.currentReading) : undefined);
    const consumption = currentReading !== undefined ? currentReading - previousReading : undefined;

    return this.prisma.client.utilityRecord.update({
      where: { id },
      data: {
        previousReading: dto.previousReading,
        currentReading: dto.currentReading,
        consumption,
        invoiceAmountRON: dto.invoiceAmountRON,
        invoiceStatus: dto.invoiceStatus,
        paymentStatus: dto.paymentStatus,
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.client.utilityRecord.delete({ where: { id } });
    return { success: true };
  }

  private async assertExists(id: string) {
    const record = await this.prisma.client.utilityRecord.findFirst({ where: { id } });
    if (!record) throw new NotFoundException('Utility record not found');
    return record;
  }
}
