import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../common/permissions.service';
import { UtilityRatesService, calculateUtilityAmount } from '../utility-rates/utility-rates.service';
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
    private readonly rates: UtilityRatesService,
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

    const invoiceAmountRON = await this.resolveAmount(
      dto.invoiceAmountRON,
      apartment.ownerId,
      dto.utilityType,
      consumption,
    );

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
        invoiceAmountRON,
        recordedById: recordedBy.id,
      },
    });
  }

  /**
   * Explicit amount always wins. Otherwise, auto-calculate from the owner's
   * configured rate for this utility type once both readings are known —
   * and only then; a rate with no formula defined for this type (e.g.
   * HEATING) or no consumption yet just leaves it for manual entry.
   */
  private async resolveAmount(
    explicitAmount: number | undefined,
    ownerId: string,
    utilityType: CreateUtilityRecordDto['utilityType'],
    consumption: number | undefined,
  ): Promise<number> {
    if (explicitAmount !== undefined) return explicitAmount;
    if (consumption === undefined) {
      throw new BadRequestException(
        'Provide both meter readings (to auto-calculate) or an invoice amount directly.',
      );
    }
    const rate = await this.rates.findForOwnerAndType(ownerId, utilityType);
    const calculated = calculateUtilityAmount(utilityType, consumption, rate);
    if (calculated === null) {
      throw new BadRequestException(
        `No rate configured for ${utilityType} — set one under Utility Rates, or enter the invoice amount manually.`,
      );
    }
    return calculated;
  }

  async update(id: string, dto: UpdateUtilityRecordDto) {
    const existing = await this.assertExists(id);
    const previousReading = dto.previousReading ?? Number(existing.previousReading ?? 0);
    const currentReading = dto.currentReading ?? (existing.currentReading ? Number(existing.currentReading) : undefined);
    const consumption = currentReading !== undefined ? currentReading - previousReading : undefined;

    // Only recalculate when a reading actually changed and no explicit
    // amount was given in this same call — an existing manually-entered
    // amount is never silently overwritten just by e.g. changing its status.
    let invoiceAmountRON = dto.invoiceAmountRON;
    const readingChanged = dto.previousReading !== undefined || dto.currentReading !== undefined;
    if (invoiceAmountRON === undefined && readingChanged && consumption !== undefined) {
      const rate = await this.rates.findForOwnerAndType(existing.ownerId, existing.utilityType);
      const calculated = calculateUtilityAmount(existing.utilityType, consumption, rate);
      if (calculated !== null) invoiceAmountRON = calculated;
    }

    return this.prisma.client.utilityRecord.update({
      where: { id },
      data: {
        previousReading: dto.previousReading,
        currentReading: dto.currentReading,
        consumption,
        invoiceAmountRON,
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
