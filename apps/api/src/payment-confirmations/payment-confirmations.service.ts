import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../common/permissions.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { paginate, skipTake } from '../common/pagination';
import { CreatePaymentConfirmationDto } from './dto/create-payment-confirmation.dto';
import { ListPaymentConfirmationsDto } from './dto/list-payment-confirmations.dto';

const EPSILON = 0.005;

@Injectable()
export class PaymentConfirmationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  async list(user: AuthenticatedUser, query: ListPaymentConfirmationsDto) {
    const { page, pageSize, apartmentId } = query;
    const allowedOwnerIds = await this.permissions.resolveAllowedOwnerIds(user);
    const scoped = this.prisma.forOwnerScope(allowedOwnerIds);
    const where = { ...(apartmentId ? { apartmentId } : {}) };
    const [data, total] = await Promise.all([
      scoped.paymentConfirmation.findMany({
        where,
        include: { documents: true, applications: { include: { invoice: true } } },
        orderBy: { paymentDate: 'desc' },
        ...skipTake(page, pageSize),
      }),
      scoped.paymentConfirmation.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  /**
   * Creates one payment confirmation and splits it across the given
   * invoices — each application is either an explicit amount or "paid in
   * full" (uses whatever is currently outstanding on that invoice). The
   * confirmation's total is the sum of its applications, never trusted from
   * the client, so it always reconciles by construction. Every invoice
   * touched has its paid/outstanding/status recomputed in the same
   * transaction.
   */
  async create(dto: CreatePaymentConfirmationDto, recordedBy: AuthenticatedUser) {
    const apartment = await this.prisma.client.apartment.findFirst({ where: { id: dto.apartmentId } });
    if (!apartment) throw new BadRequestException('Apartment not found');

    const hasManual = !!dto.applications && dto.applications.length > 0;
    const hasAutoApply = dto.autoApplyAmountRON !== undefined;
    if (hasManual === hasAutoApply) {
      throw new BadRequestException('Provide either applications or autoApplyAmountRON, not both');
    }

    return this.prisma.client.$transaction(async (tx) => {
      let totalAmountRON = 0;
      let creditContributionRON = 0;
      const resolvedApplications: { invoiceId: string; amountRON: number }[] = [];

      if (hasAutoApply) {
        let remaining = round2(dto.autoApplyAmountRON!);
        const outstandingInvoices = await tx.apartmentInvoice.findMany({
          where: { apartmentId: dto.apartmentId, status: { in: ['UNPAID', 'PARTIALLY_PAID'] } },
          orderBy: { periodMonth: 'asc' },
        });

        for (const invoice of outstandingInvoices) {
          if (remaining <= EPSILON) break;
          const outstanding = Number(invoice.outstandingAmountRON);
          const amount = round2(Math.min(remaining, outstanding));
          if (amount <= 0) continue;

          resolvedApplications.push({ invoiceId: invoice.id, amountRON: amount });
          totalAmountRON = round2(totalAmountRON + amount);
          remaining = round2(remaining - amount);

          const newPaid = round2(Number(invoice.paidAmountRON) + amount);
          const newOutstanding = round2(Number(invoice.totalAmountRON) - newPaid);
          await tx.apartmentInvoice.update({
            where: { id: invoice.id },
            data: {
              paidAmountRON: newPaid,
              outstandingAmountRON: Math.max(0, newOutstanding),
              status: newOutstanding <= EPSILON ? 'PAID' : 'PARTIALLY_PAID',
            },
          });
        }

        // Nothing left to apply — the rest becomes a standing credit on the
        // apartment, consumed automatically the next time an invoice is created for it.
        if (remaining > EPSILON) {
          creditContributionRON = remaining;
          totalAmountRON = round2(totalAmountRON + remaining);
          await tx.apartment.update({
            where: { id: apartment.id },
            data: { creditBalanceRON: { increment: remaining } },
          });
        }
      } else {
        for (const app of dto.applications!) {
          const invoice = await tx.apartmentInvoice.findFirst({ where: { id: app.invoiceId } });
          if (!invoice) throw new BadRequestException(`Invoice ${app.invoiceId} not found`);
          if (invoice.apartmentId !== dto.apartmentId) {
            throw new BadRequestException('All invoices in a payment confirmation must belong to the same apartment');
          }

          const outstanding = Number(invoice.outstandingAmountRON);
          const amount = app.paidInFull ? outstanding : (app.amountRON ?? 0);

          if (amount <= 0) throw new BadRequestException(`Payment amount for invoice ${invoice.id} must be greater than 0`);
          if (amount > outstanding + EPSILON) {
            throw new BadRequestException(
              `Payment of ${amount} RON for invoice ${invoice.invoiceNumber ?? invoice.id} exceeds its outstanding balance of ${outstanding} RON`,
            );
          }

          const clampedAmount = round2(Math.min(amount, outstanding));
          totalAmountRON = round2(totalAmountRON + clampedAmount);
          resolvedApplications.push({ invoiceId: invoice.id, amountRON: clampedAmount });

          const newPaid = round2(Number(invoice.paidAmountRON) + clampedAmount);
          const newOutstanding = round2(Number(invoice.totalAmountRON) - newPaid);
          await tx.apartmentInvoice.update({
            where: { id: invoice.id },
            data: {
              paidAmountRON: newPaid,
              outstandingAmountRON: Math.max(0, newOutstanding),
              status: newOutstanding <= EPSILON ? 'PAID' : 'PARTIALLY_PAID',
            },
          });
        }
      }

      const confirmation = await tx.paymentConfirmation.create({
        data: {
          apartmentId: dto.apartmentId,
          ownerId: apartment.ownerId,
          totalAmountRON,
          creditContributionRON,
          paymentDate: new Date(dto.paymentDate),
          paymentMethod: dto.paymentMethod,
          notes: dto.notes,
          recordedById: recordedBy.id,
          applications: { create: resolvedApplications },
        },
        include: { applications: { include: { invoice: true } } },
      });

      // Cash never reaches the Owner's bank account by itself — track it as a
      // task until the PM hands it over, visible in both the PM's and the
      // Owner's Tasks tab (same owner-scoping every other task uses).
      if (dto.paymentMethod === 'CASH') {
        await tx.task.create({
          data: {
            ownerId: apartment.ownerId,
            apartmentId: apartment.id,
            paymentConfirmationId: confirmation.id,
            title: `Hand over ${totalAmountRON} RON cash — ${apartment.name}`,
            description: `Collected in cash from the tenant on ${dto.paymentDate}. Hand this over to the Owner and mark this task Completed once done.`,
            assignedToRole: 'ADMIN',
            createdById: recordedBy.id,
          },
        });
      }

      return confirmation;
    });
  }

  async remove(id: string) {
    const confirmation = await this.prisma.client.paymentConfirmation.findFirst({
      where: { id },
      include: { applications: true },
    });
    if (!confirmation) throw new NotFoundException('Payment confirmation not found');

    // Reversing a confirmation un-applies every one of its applications from
    // the invoices it touched — otherwise a deleted confirmation would leave
    // invoices permanently (and silently) marked as paid.
    return this.prisma.client.$transaction(async (tx) => {
      for (const app of confirmation.applications) {
        const invoice = await tx.apartmentInvoice.findFirst({ where: { id: app.invoiceId } });
        if (!invoice) continue;
        const newPaid = round2(Math.max(0, Number(invoice.paidAmountRON) - Number(app.amountRON)));
        const newOutstanding = round2(Number(invoice.totalAmountRON) - newPaid);
        await tx.apartmentInvoice.update({
          where: { id: invoice.id },
          data: {
            paidAmountRON: newPaid,
            outstandingAmountRON: newOutstanding,
            status: newOutstanding <= EPSILON ? 'PAID' : newPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
          },
        });
      }

      // Undo whatever this confirmation did to the apartment's standing
      // credit balance: give back credit it consumed (paymentMethod CREDIT),
      // or take back credit it created (creditContributionRON > 0).
      if (confirmation.paymentMethod === 'CREDIT') {
        await tx.apartment.update({
          where: { id: confirmation.apartmentId },
          data: { creditBalanceRON: { increment: Number(confirmation.totalAmountRON) } },
        });
      } else if (Number(confirmation.creditContributionRON) > 0) {
        const apartment = await tx.apartment.findFirst({ where: { id: confirmation.apartmentId } });
        const decrement = Math.min(Number(confirmation.creditContributionRON), Number(apartment?.creditBalanceRON ?? 0));
        await tx.apartment.update({
          where: { id: confirmation.apartmentId },
          data: { creditBalanceRON: { decrement } },
        });
      }

      await tx.paymentConfirmation.delete({ where: { id } });
      return { success: true };
    });
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
