import { Injectable } from '@nestjs/common';
import { UtilityType } from '@pro-tenant/db';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../common/permissions.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { UpsertUtilityRateDto } from './dto/upsert-utility-rate.dto';

/** Accepts a plain number/string (as used in tests) or a Prisma Decimal (real DB rows) — anything Number() can coerce. */
type Numeric = number | string | { toString(): string };

interface RateLike {
  pricePerUnit: Numeric;
  conversionFactor?: Numeric | null;
  vatPercent?: Numeric | null;
  maintenanceFee?: Numeric | null;
  maintenanceVatPercent?: Numeric | null;
}

/**
 * Turns a meter-reading consumption into the RON amount to put on the
 * invoice, per the owner's configured rate for that utility type. Formulas
 * differ by type (PM-provided worked examples):
 *   ELECTRICITY: consumption * pricePerUnit                              (price already VAT-incl.)
 *   GAS:         consumption * conversionFactor(m3->kWh) * pricePerUnit  (price already VAT-incl.)
 *   COLD/HOT_WATER: consumption * pricePerUnit * (1 + vat%) + maintenanceFee * (1 + maintenanceVat%)
 * Returns null when there's nothing to calculate from (no rate configured,
 * or a utility type with no defined formula yet e.g. HEATING) — the amount
 * then has to be entered manually.
 */
export function calculateUtilityAmount(
  utilityType: UtilityType,
  consumption: number,
  rate: RateLike | null | undefined,
): number | null {
  if (!rate) return null;
  const price = Number(rate.pricePerUnit);

  switch (utilityType) {
    case 'ELECTRICITY':
      return round2(consumption * price);
    case 'GAS': {
      const factor = Number(rate.conversionFactor ?? 1);
      return round2(consumption * factor * price);
    }
    case 'COLD_WATER':
    case 'HOT_WATER': {
      const vat = Number(rate.vatPercent ?? 0);
      const usageCharge = consumption * price * (1 + vat / 100);
      const maintFee = Number(rate.maintenanceFee ?? 0);
      const maintVat = Number(rate.maintenanceVatPercent ?? 0);
      const maintenanceCharge = maintFee * (1 + maintVat / 100);
      return round2(usageCharge + maintenanceCharge);
    }
    default:
      return null;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class UtilityRatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  async list(user: AuthenticatedUser, ownerId?: string) {
    const allowedOwnerIds = await this.permissions.resolveAllowedOwnerIds(user);
    return this.prisma.forOwnerScope(allowedOwnerIds).utilityRate.findMany({
      where: ownerId ? { ownerId } : {},
      orderBy: [{ ownerId: 'asc' }, { utilityType: 'asc' }],
    });
  }

  /** For internal use by UtilitiesService — unscoped, single lookup by the exact owner+type. */
  async findForOwnerAndType(ownerId: string, utilityType: UtilityType) {
    return this.prisma.client.utilityRate.findUnique({
      where: { ownerId_utilityType: { ownerId, utilityType } },
    });
  }

  async upsert(dto: UpsertUtilityRateDto, updatedBy: AuthenticatedUser) {
    return this.prisma.client.utilityRate.upsert({
      where: { ownerId_utilityType: { ownerId: dto.ownerId, utilityType: dto.utilityType } },
      create: {
        ownerId: dto.ownerId,
        utilityType: dto.utilityType,
        pricePerUnit: dto.pricePerUnit,
        conversionFactor: dto.conversionFactor,
        vatPercent: dto.vatPercent,
        maintenanceFee: dto.maintenanceFee,
        maintenanceVatPercent: dto.maintenanceVatPercent,
        updatedById: updatedBy.id,
      },
      update: {
        pricePerUnit: dto.pricePerUnit,
        conversionFactor: dto.conversionFactor,
        vatPercent: dto.vatPercent,
        maintenanceFee: dto.maintenanceFee,
        maintenanceVatPercent: dto.maintenanceVatPercent,
        updatedById: updatedBy.id,
      },
    });
  }
}
