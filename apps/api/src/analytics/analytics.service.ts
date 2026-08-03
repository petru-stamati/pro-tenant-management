import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';

/**
 * Every number here is computed server-side in one request — never
 * client-aggregated (Phase 1 §3, PRD §4.1 design decision). No Redis cache
 * yet (not provisioned on this machine, see packages/db/README.md); the
 * queries are cheap enough at the current ~20-apartment scale that this
 * isn't a correctness issue, just a future perf optimization.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private currentMonthRange() {
    const now = new Date();
    return {
      gte: new Date(now.getFullYear(), now.getMonth(), 1),
      lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    };
  }

  async ownerSummary(user: AuthenticatedUser, ownerId: string) {
    if (user.roleKey === 'OWNER' && user.ownerId !== ownerId) {
      throw new NotFoundException('Owner not found');
    }
    const owner = await this.prisma.client.owner.findFirst({ where: { id: ownerId } });
    if (!owner) throw new NotFoundException('Owner not found');

    const [
      totalApartments,
      occupiedApartments,
      activeLeases,
      outstanding,
      outstandingRON,
      paidRON,
      openMaintenance,
      nextExpiring,
    ] = await Promise.all([
      this.prisma.client.apartment.count({ where: { ownerId } }),
      this.prisma.client.apartment.count({ where: { ownerId, status: 'OCCUPIED' } }),
      this.prisma.client.lease.findMany({ where: { ownerId, status: 'ACTIVE' }, select: { rentAmountEUR: true } }),
      this.prisma.client.rentPayment.aggregate({
        where: { ownerId, status: { in: ['UNPAID', 'PARTIALLY_PAID', 'LATE'] } },
        _sum: { outstandingAmountEUR: true },
      }),
      this.prisma.client.apartmentInvoice.aggregate({
        where: { ownerId, status: { in: ['UNPAID', 'PARTIALLY_PAID'] } },
        _sum: { outstandingAmountRON: true },
      }),
      this.prisma.client.paymentConfirmation.aggregate({
        where: { ownerId, paymentDate: this.currentMonthRange() },
        _sum: { totalAmountRON: true },
      }),
      this.prisma.client.maintenanceRequest.count({
        where: { ownerId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      }),
      this.prisma.client.lease.findFirst({
        where: { ownerId, status: 'ACTIVE', endDate: { gte: new Date() } },
        orderBy: { endDate: 'asc' },
        include: { apartment: true },
      }),
    ]);

    const monthlyRentalIncomeEUR = activeLeases.reduce((sum, l) => sum + Number(l.rentAmountEUR), 0);

    return {
      totalApartments,
      occupiedApartments,
      vacantApartments: totalApartments - occupiedApartments,
      occupancyRate: totalApartments === 0 ? 0 : Math.round((occupiedApartments / totalApartments) * 1000) / 10,
      monthlyRentalIncomeEUR,
      outstandingRentEUR: Number(outstanding._sum.outstandingAmountEUR ?? 0),
      outstandingRON: Number(outstandingRON._sum.outstandingAmountRON ?? 0),
      paidRON: Number(paidRON._sum.totalAmountRON ?? 0),
      openMaintenanceCount: openMaintenance,
      nextLeaseExpiration: nextExpiring
        ? {
            apartmentName: nextExpiring.apartment.name,
            endDate: nextExpiring.endDate,
            daysRemaining: Math.ceil((nextExpiring.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
          }
        : null,
    };
  }

  async adminSummary(user: AuthenticatedUser) {
    if (user.roleKey !== 'ADMIN') throw new ForbiddenException();

    const [
      totalApartments,
      occupiedApartments,
      activeLeases,
      outstanding,
      outstandingRON,
      paidRON,
      openMaintenance,
      revenueByOwner,
    ] = await Promise.all([
      this.prisma.client.apartment.count(),
      this.prisma.client.apartment.count({ where: { status: 'OCCUPIED' } }),
      this.prisma.client.lease.findMany({ where: { status: 'ACTIVE' }, select: { rentAmountEUR: true } }),
      this.prisma.client.rentPayment.aggregate({
        where: { status: { in: ['UNPAID', 'PARTIALLY_PAID', 'LATE'] } },
        _sum: { outstandingAmountEUR: true },
      }),
      this.prisma.client.apartmentInvoice.aggregate({
        where: { status: { in: ['UNPAID', 'PARTIALLY_PAID'] } },
        _sum: { outstandingAmountRON: true },
      }),
      this.prisma.client.paymentConfirmation.aggregate({
        where: { paymentDate: this.currentMonthRange() },
        _sum: { totalAmountRON: true },
      }),
      this.prisma.client.maintenanceRequest.count({ where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
      this.prisma.client.lease.groupBy({
        by: ['ownerId'],
        where: { status: 'ACTIVE' },
        _sum: { rentAmountEUR: true },
      }),
    ]);

    const owners = await this.prisma.client.owner.findMany({
      where: { id: { in: revenueByOwner.map((r) => r.ownerId) } },
      select: { id: true, companyName: true },
    });
    const ownerNameById = new Map(owners.map((o) => [o.id, o.companyName]));

    return {
      totalApartments,
      occupiedApartments,
      vacantApartments: totalApartments - occupiedApartments,
      occupancyRate: totalApartments === 0 ? 0 : Math.round((occupiedApartments / totalApartments) * 1000) / 10,
      monthlyRevenueEUR: activeLeases.reduce((sum, l) => sum + Number(l.rentAmountEUR), 0),
      outstandingRentEUR: Number(outstanding._sum.outstandingAmountEUR ?? 0),
      outstandingRON: Number(outstandingRON._sum.outstandingAmountRON ?? 0),
      paidRON: Number(paidRON._sum.totalAmountRON ?? 0),
      openMaintenanceCount: openMaintenance,
      revenueByOwner: revenueByOwner.map((r) => ({
        ownerId: r.ownerId,
        ownerName: ownerNameById.get(r.ownerId) ?? 'Unknown',
        monthlyRevenueEUR: Number(r._sum.rentAmountEUR ?? 0),
      })),
    };
  }

  async revenue(groupBy: 'month' | 'owner') {
    if (groupBy === 'owner') {
      const grouped = await this.prisma.client.lease.groupBy({
        by: ['ownerId'],
        where: { status: 'ACTIVE' },
        _sum: { rentAmountEUR: true },
      });
      const owners = await this.prisma.client.owner.findMany({
        where: { id: { in: grouped.map((g) => g.ownerId) } },
        select: { id: true, companyName: true },
      });
      const nameById = new Map(owners.map((o) => [o.id, o.companyName]));
      return grouped.map((g) => ({
        ownerId: g.ownerId,
        ownerName: nameById.get(g.ownerId) ?? 'Unknown',
        revenueEUR: Number(g._sum.rentAmountEUR ?? 0),
      }));
    }

    // Month grouping done in JS — data volume at this scale doesn't justify raw SQL date-truncation.
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const payments = await this.prisma.client.rentPayment.findMany({
      where: { dueDate: { gte: twelveMonthsAgo } },
      select: { dueDate: true, paidAmountEUR: true },
    });
    const byMonth = new Map<string, number>();
    for (const p of payments) {
      const key = `${p.dueDate.getFullYear()}-${String(p.dueDate.getMonth() + 1).padStart(2, '0')}`;
      byMonth.set(key, (byMonth.get(key) ?? 0) + Number(p.paidAmountEUR));
    }
    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenueEUR]) => ({ month, revenueEUR }));
  }

  async leaseExpirations(user: AuthenticatedUser, withinDays: number, ownerId?: string) {
    const cutoff = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000);
    const where = {
      status: 'ACTIVE' as const,
      endDate: { gte: new Date(), lte: cutoff },
      ...(user.roleKey === 'OWNER' ? { ownerId: user.ownerId ?? '__none__' } : ownerId ? { ownerId } : {}),
    };
    return this.prisma.client.lease.findMany({
      where,
      include: { apartment: true, tenant: true, owner: true },
      orderBy: { endDate: 'asc' },
    });
  }
}
