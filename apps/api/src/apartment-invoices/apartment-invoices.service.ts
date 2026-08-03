import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../common/permissions.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { paginate, skipTake } from '../common/pagination';
import { CreateApartmentInvoiceDto } from './dto/create-apartment-invoice.dto';
import { UpdateApartmentInvoiceDto } from './dto/update-apartment-invoice.dto';
import { ListApartmentInvoicesDto } from './dto/list-apartment-invoices.dto';

@Injectable()
export class ApartmentInvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  async list(user: AuthenticatedUser, query: ListApartmentInvoicesDto) {
    const { page, pageSize, apartmentId, month, outstandingOnly } = query;
    const allowedOwnerIds = await this.permissions.resolveAllowedOwnerIds(user);
    const scoped = this.prisma.forOwnerScope(allowedOwnerIds);
    const monthFilter = !outstandingOnly && month ? monthRange(month) : undefined;
    const where = {
      ...(apartmentId ? { apartmentId } : {}),
      ...(monthFilter ? { periodMonth: monthFilter } : {}),
      ...(outstandingOnly ? { status: { in: ['UNPAID', 'PARTIALLY_PAID'] as ('UNPAID' | 'PARTIALLY_PAID')[] } } : {}),
    };
    const [data, total] = await Promise.all([
      scoped.apartmentInvoice.findMany({
        where,
        include: {
          apartment: true,
          documents: true,
          applications: {
            orderBy: { createdAt: 'desc' },
            include: { paymentConfirmation: { include: { documents: true } } },
          },
        },
        orderBy: [{ periodMonth: 'desc' }, { createdAt: 'desc' }],
        ...skipTake(page, pageSize),
      }),
      scoped.apartmentInvoice.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async create(dto: CreateApartmentInvoiceDto, uploadedBy: AuthenticatedUser) {
    const apartment = await this.prisma.client.apartment.findFirst({ where: { id: dto.apartmentId } });
    if (!apartment) throw new BadRequestException('Apartment not found');

    const creditBalance = Number(apartment.creditBalanceRON ?? 0);
    if (creditBalance <= 0) {
      return this.prisma.client.apartmentInvoice.create({
        data: {
          apartmentId: dto.apartmentId,
          ownerId: apartment.ownerId,
          leaseId: dto.leaseId,
          type: dto.type,
          invoiceNumber: dto.invoiceNumber,
          issueDate: new Date(dto.issueDate),
          dueDate: new Date(dto.dueDate),
          periodMonth: new Date(dto.periodMonth),
          totalAmountRON: dto.totalAmountRON,
          outstandingAmountRON: dto.totalAmountRON,
          autoExtracted: dto.autoExtracted ?? false,
          uploadedById: uploadedBy.id,
        },
      });
    }

    // Apartment is carrying a standing credit from a prior overpayment —
    // consume as much of it as this invoice needs immediately, recorded as a
    // real payment (method CREDIT) so it shows up in the invoice's payment
    // history rather than silently pre-filling paidAmountRON.
    return this.prisma.client.$transaction(async (tx) => {
      const consumed = round2(Math.min(creditBalance, dto.totalAmountRON));
      const paidAmountRON = consumed;
      const outstandingAmountRON = round2(dto.totalAmountRON - consumed);

      const invoice = await tx.apartmentInvoice.create({
        data: {
          apartmentId: dto.apartmentId,
          ownerId: apartment.ownerId,
          leaseId: dto.leaseId,
          type: dto.type,
          invoiceNumber: dto.invoiceNumber,
          issueDate: new Date(dto.issueDate),
          dueDate: new Date(dto.dueDate),
          periodMonth: new Date(dto.periodMonth),
          totalAmountRON: dto.totalAmountRON,
          paidAmountRON,
          outstandingAmountRON,
          status: outstandingAmountRON <= 0 ? 'PAID' : 'PARTIALLY_PAID',
          autoExtracted: dto.autoExtracted ?? false,
          uploadedById: uploadedBy.id,
        },
      });

      await tx.paymentConfirmation.create({
        data: {
          apartmentId: dto.apartmentId,
          ownerId: apartment.ownerId,
          totalAmountRON: consumed,
          paymentDate: new Date(dto.issueDate),
          paymentMethod: 'CREDIT',
          notes: 'Applied automatically from the apartment credit balance carried over from a prior overpayment.',
          recordedById: uploadedBy.id,
          applications: { create: [{ invoiceId: invoice.id, amountRON: consumed }] },
        },
      });

      await tx.apartment.update({
        where: { id: apartment.id },
        data: { creditBalanceRON: { decrement: consumed } },
      });

      return invoice;
    });
  }

  async update(id: string, dto: UpdateApartmentInvoiceDto) {
    const existing = await this.assertExists(id);
    const totalAmountRON = dto.totalAmountRON ?? Number(existing.totalAmountRON);
    const outstandingAmountRON = totalAmountRON - Number(existing.paidAmountRON);
    if (outstandingAmountRON < 0) {
      throw new BadRequestException('New total is less than the amount already paid against this invoice');
    }

    return this.prisma.client.apartmentInvoice.update({
      where: { id },
      data: {
        type: dto.type,
        invoiceNumber: dto.invoiceNumber,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        periodMonth: dto.periodMonth ? new Date(dto.periodMonth) : undefined,
        totalAmountRON: dto.totalAmountRON,
        outstandingAmountRON,
        status: outstandingAmountRON === 0 ? 'PAID' : Number(existing.paidAmountRON) > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
        autoExtracted: dto.totalAmountRON !== undefined ? false : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.client.apartmentInvoice.delete({ where: { id } });
    return { success: true };
  }

  private async assertExists(id: string) {
    const record = await this.prisma.client.apartmentInvoice.findFirst({ where: { id } });
    if (!record) throw new NotFoundException('Invoice not found');
    return record;
  }
}

/** "YYYY-MM" -> a [gte, lt) range covering that whole calendar month. */
function monthRange(month: string): { gte: Date; lt: Date } {
  const [year, m] = month.split('-').map(Number);
  return { gte: new Date(Date.UTC(year, m - 1, 1)), lt: new Date(Date.UTC(year, m, 1)) };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
