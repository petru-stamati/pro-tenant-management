import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../common/permissions.service';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { paginate, skipTake } from '../common/pagination';
import { CreateRentPaymentDto } from './dto/create-rent-payment.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { ListRentPaymentsDto } from './dto/list-rent-payments.dto';

@Injectable()
export class RentPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly exchangeRates: ExchangeRatesService,
  ) {}

  async list(user: AuthenticatedUser, query: ListRentPaymentsDto) {
    const { page, pageSize, apartmentId, leaseId, status } = query;
    const allowedOwnerIds = await this.permissions.resolveAllowedOwnerIds(user);
    const scoped = this.prisma.forOwnerScope(allowedOwnerIds);
    const where = {
      ...(apartmentId ? { apartmentId } : {}),
      ...(leaseId ? { leaseId } : {}),
      ...(status ? { status: status as never } : {}),
    };
    const [data, total] = await Promise.all([
      scoped.rentPayment.findMany({
        where,
        include: { apartment: true, invoice: true },
        orderBy: { dueDate: 'desc' },
        ...skipTake(page, pageSize),
      }),
      scoped.rentPayment.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const allowedOwnerIds = await this.permissions.resolveAllowedOwnerIds(user);
    const payment = await this.prisma.forOwnerScope(allowedOwnerIds).rentPayment.findFirst({
      where: { id },
      include: { apartment: true, lease: true, invoice: true },
    });
    if (!payment) throw new NotFoundException('Rent payment not found');
    return payment;
  }

  async create(dto: CreateRentPaymentDto, recordedBy: AuthenticatedUser) {
    const lease = await this.prisma.client.lease.findFirst({ where: { id: dto.leaseId } });
    if (!lease) throw new BadRequestException('Lease not found');

    return this.prisma.client.rentPayment.create({
      data: {
        apartmentId: lease.apartmentId,
        ownerId: lease.ownerId,
        leaseId: lease.id,
        dueDate: new Date(dto.dueDate),
        rentAmountEUR: dto.rentAmountEUR,
        outstandingAmountEUR: dto.rentAmountEUR,
        notes: dto.notes,
        recordedById: recordedBy.id,
      },
    });
  }

  async recordPayment(id: string, dto: RecordPaymentDto) {
    const payment = await this.assertExists(id);
    const paid = dto.paidAmountEUR;
    const rentAmount = Number(payment.rentAmountEUR);
    const outstanding = Math.max(0, rentAmount - paid);

    const status =
      paid >= rentAmount ? 'PAID' : paid > 0 ? 'PARTIALLY_PAID' : payment.dueDate < new Date() ? 'LATE' : 'UNPAID';

    return this.prisma.client.rentPayment.update({
      where: { id },
      data: {
        paidAmountEUR: paid,
        outstandingAmountEUR: outstanding,
        status,
        paidDate: dto.paidDate ? new Date(dto.paidDate) : status === 'PAID' ? new Date() : undefined,
        notes: dto.notes ?? payment.notes,
      },
    });
  }

  /** Snapshots the current BNR rate into a tenant-facing Invoice — never recalculated later (PRD §7). */
  async generateInvoice(id: string) {
    const payment = await this.prisma.client.rentPayment.findFirst({
      where: { id },
      include: { lease: true, invoice: true },
    });
    if (!payment) throw new NotFoundException('Rent payment not found');
    if (payment.invoice) throw new BadRequestException('An invoice already exists for this rent payment');

    const invoiceDate = new Date();
    const rate = await this.exchangeRates.getRateForDate(invoiceDate);
    const amountEUR = Number(payment.rentAmountEUR);
    const amountRON = Math.round(amountEUR * Number(rate.rateRON) * 100) / 100;

    return this.prisma.client.invoice.create({
      data: {
        rentPaymentId: payment.id,
        leaseId: payment.leaseId,
        apartmentId: payment.apartmentId,
        ownerId: payment.ownerId,
        tenantId: payment.lease.tenantId,
        amountEUR,
        exchangeRateRON: rate.rateRON,
        invoiceDate,
        amountRON,
        dueDate: payment.dueDate,
      },
    });
  }

  private async assertExists(id: string) {
    const payment = await this.prisma.client.rentPayment.findFirst({ where: { id } });
    if (!payment) throw new NotFoundException('Rent payment not found');
    return payment;
  }
}
