import { BadRequestException } from '@nestjs/common';
import { PaymentConfirmationsService } from './payment-confirmations.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { id: 'pm-1', roleKey: 'ADMIN', ownerId: null, tenantId: null, tokenVersion: 0, ...overrides };
}

function makeInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv',
    apartmentId: 'apt-1',
    invoiceNumber: 'INV-1',
    totalAmountRON: 1000,
    paidAmountRON: 0,
    outstandingAmountRON: 1000,
    status: 'UNPAID',
    periodMonth: '2026-07-01',
    ...overrides,
  };
}

function makePrisma(
  invoices: Record<string, ReturnType<typeof makeInvoice>>,
  apartmentOverrides: Record<string, unknown> = {},
) {
  const store = { ...invoices };
  const apartment = { id: 'apt-1', ownerId: 'owner-1', name: 'Apt 1', creditBalanceRON: 0, ...apartmentOverrides };
  const tx = {
    apartmentInvoice: {
      findFirst: jest.fn(async (args: { where: { id: string } }) => store[args.where.id] ?? null),
      findMany: jest.fn(async (args: { where: { apartmentId: string; status?: { in: string[] } } }) =>
        Object.values(store)
          .filter((inv) => inv.apartmentId === args.where.apartmentId)
          .filter((inv) => !args.where.status || args.where.status.in.includes(inv.status as string))
          .sort((a, b) => String(a.periodMonth).localeCompare(String(b.periodMonth))),
      ),
      update: jest.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        store[args.where.id] = { ...store[args.where.id], ...args.data };
        return store[args.where.id];
      }),
    },
    paymentConfirmation: {
      create: jest.fn(async (args: { data: Record<string, unknown> }) => ({ id: 'pc-1', ...args.data })),
      delete: jest.fn(async () => ({ success: true })),
    },
    apartment: {
      findFirst: jest.fn(async () => apartment),
      update: jest.fn(async (args: { data: Record<string, unknown> }) => {
        const data = args.data as { creditBalanceRON?: { increment?: number; decrement?: number } };
        if (data.creditBalanceRON?.increment !== undefined) {
          apartment.creditBalanceRON += data.creditBalanceRON.increment;
        }
        if (data.creditBalanceRON?.decrement !== undefined) {
          apartment.creditBalanceRON -= data.creditBalanceRON.decrement;
        }
        return apartment;
      }),
    },
    task: {
      create: jest.fn(async (args: { data: Record<string, unknown> }) => ({ id: 'task-1', ...args.data })),
    },
  };
  return {
    client: {
      apartment: { findFirst: jest.fn().mockResolvedValue(apartment) },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
    },
    forOwnerScope: jest.fn(),
    tx,
    store,
    apartment,
  };
}

function makePermissions() {
  return { resolveAllowedOwnerIds: jest.fn().mockResolvedValue('all') };
}

describe('PaymentConfirmationsService.create', () => {
  it('splits a single payment across three invoices — leftover last month, this month rent in full, part of utilities', async () => {
    // Mirrors the exact worked example from the spec: 1300 RON covering a
    // 200 RON leftover balance, a 1000 RON rent invoice in full, and 100 of
    // a 200 RON utilities invoice, leaving 100 RON still outstanding on it.
    const prisma = makePrisma({
      leftover: makeInvoice({ id: 'leftover', totalAmountRON: 200, outstandingAmountRON: 200 }),
      rent: makeInvoice({ id: 'rent', totalAmountRON: 1000, outstandingAmountRON: 1000 }),
      utilities: makeInvoice({ id: 'utilities', totalAmountRON: 200, outstandingAmountRON: 200 }),
    });
    const service = new PaymentConfirmationsService(prisma as never, makePermissions() as never);

    const result = await service.create(
      {
        apartmentId: 'apt-1',
        paymentDate: '2026-07-31',
        applications: [
          { invoiceId: 'leftover', paidInFull: true },
          { invoiceId: 'rent', paidInFull: true },
          { invoiceId: 'utilities', amountRON: 100 },
        ],
      } as never,
      makeUser({}),
    );

    expect((result as { totalAmountRON: number }).totalAmountRON).toBe(1300);
    expect(prisma.store.leftover).toMatchObject({ paidAmountRON: 200, outstandingAmountRON: 0, status: 'PAID' });
    expect(prisma.store.rent).toMatchObject({ paidAmountRON: 1000, outstandingAmountRON: 0, status: 'PAID' });
    expect(prisma.store.utilities).toMatchObject({
      paidAmountRON: 100,
      outstandingAmountRON: 100,
      status: 'PARTIALLY_PAID',
    });
  });

  it('rejects a payment that exceeds an invoice outstanding balance', async () => {
    const prisma = makePrisma({ inv: makeInvoice({ outstandingAmountRON: 100 }) });
    const service = new PaymentConfirmationsService(prisma as never, makePermissions() as never);

    await expect(
      service.create(
        { apartmentId: 'apt-1', paymentDate: '2026-07-31', applications: [{ invoiceId: 'inv', amountRON: 150 }] } as never,
        makeUser({}),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an invoice from a different apartment', async () => {
    const prisma = makePrisma({ inv: makeInvoice({ apartmentId: 'other-apt' }) });
    const service = new PaymentConfirmationsService(prisma as never, makePermissions() as never);

    await expect(
      service.create(
        { apartmentId: 'apt-1', paymentDate: '2026-07-31', applications: [{ invoiceId: 'inv', paidInFull: true }] } as never,
        makeUser({}),
      ),
    ).rejects.toThrow('same apartment');
  });

  it('rejects a zero or negative payment amount', async () => {
    const prisma = makePrisma({ inv: makeInvoice() });
    const service = new PaymentConfirmationsService(prisma as never, makePermissions() as never);

    await expect(
      service.create(
        { apartmentId: 'apt-1', paymentDate: '2026-07-31', applications: [{ invoiceId: 'inv', amountRON: 0 }] } as never,
        makeUser({}),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('marks a fully-paid-in-full invoice PAID and a still-partial one PARTIALLY_PAID on a single-invoice payment', async () => {
    const prisma = makePrisma({ inv: makeInvoice({ totalAmountRON: 500, outstandingAmountRON: 500 }) });
    const service = new PaymentConfirmationsService(prisma as never, makePermissions() as never);

    await service.create(
      { apartmentId: 'apt-1', paymentDate: '2026-07-31', applications: [{ invoiceId: 'inv', amountRON: 300 }] } as never,
      makeUser({}),
    );

    expect(prisma.store.inv).toMatchObject({ paidAmountRON: 300, outstandingAmountRON: 200, status: 'PARTIALLY_PAID' });
  });

  it('creates a "hand over cash" task assigned to the PM when paymentMethod is CASH', async () => {
    const prisma = makePrisma({ inv: makeInvoice({ totalAmountRON: 500, outstandingAmountRON: 500 }) });
    const service = new PaymentConfirmationsService(prisma as never, makePermissions() as never);

    await service.create(
      {
        apartmentId: 'apt-1',
        paymentDate: '2026-07-31',
        paymentMethod: 'CASH',
        applications: [{ invoiceId: 'inv', amountRON: 500 }],
      } as never,
      makeUser({}),
    );

    expect(prisma.tx.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerId: 'owner-1',
          apartmentId: 'apt-1',
          paymentConfirmationId: 'pc-1',
          assignedToRole: 'ADMIN',
        }),
      }),
    );
  });

  it('does not create a task when paymentMethod is BANK_TRANSFER', async () => {
    const prisma = makePrisma({ inv: makeInvoice({ totalAmountRON: 500, outstandingAmountRON: 500 }) });
    const service = new PaymentConfirmationsService(prisma as never, makePermissions() as never);

    await service.create(
      {
        apartmentId: 'apt-1',
        paymentDate: '2026-07-31',
        paymentMethod: 'BANK_TRANSFER',
        applications: [{ invoiceId: 'inv', amountRON: 500 }],
      } as never,
      makeUser({}),
    );

    expect(prisma.tx.task.create).not.toHaveBeenCalled();
  });

  it('rejects when both applications and autoApplyAmountRON are provided', async () => {
    const prisma = makePrisma({ inv: makeInvoice() });
    const service = new PaymentConfirmationsService(prisma as never, makePermissions() as never);

    await expect(
      service.create(
        {
          apartmentId: 'apt-1',
          paymentDate: '2026-07-31',
          applications: [{ invoiceId: 'inv', amountRON: 100 }],
          autoApplyAmountRON: 100,
        } as never,
        makeUser({}),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when neither applications nor autoApplyAmountRON are provided', async () => {
    const prisma = makePrisma({ inv: makeInvoice() });
    const service = new PaymentConfirmationsService(prisma as never, makePermissions() as never);

    await expect(
      service.create({ apartmentId: 'apt-1', paymentDate: '2026-07-31' } as never, makeUser({})),
    ).rejects.toThrow(BadRequestException);
  });

  it('auto-applies a lump sum oldest-first across outstanding invoices', async () => {
    const prisma = makePrisma({
      jun: makeInvoice({ id: 'jun', periodMonth: '2026-06-01', totalAmountRON: 500, outstandingAmountRON: 500 }),
      jul: makeInvoice({ id: 'jul', periodMonth: '2026-07-01', totalAmountRON: 1000, outstandingAmountRON: 1000 }),
    });
    const service = new PaymentConfirmationsService(prisma as never, makePermissions() as never);

    const result = await service.create(
      { apartmentId: 'apt-1', paymentDate: '2026-07-31', autoApplyAmountRON: 800 } as never,
      makeUser({}),
    );

    expect((result as { totalAmountRON: number }).totalAmountRON).toBe(800);
    expect(prisma.store.jun).toMatchObject({ paidAmountRON: 500, outstandingAmountRON: 0, status: 'PAID' });
    expect(prisma.store.jul).toMatchObject({ paidAmountRON: 300, outstandingAmountRON: 700, status: 'PARTIALLY_PAID' });
    expect(prisma.apartment.creditBalanceRON).toBe(0);
  });

  it('carries the remainder as apartment credit when auto-apply amount exceeds all outstanding invoices', async () => {
    const prisma = makePrisma({
      jun: makeInvoice({ id: 'jun', periodMonth: '2026-06-01', totalAmountRON: 500, outstandingAmountRON: 500 }),
    });
    const service = new PaymentConfirmationsService(prisma as never, makePermissions() as never);

    const result = await service.create(
      { apartmentId: 'apt-1', paymentDate: '2026-07-31', autoApplyAmountRON: 800 } as never,
      makeUser({}),
    );

    expect((result as { totalAmountRON: number; creditContributionRON: number }).totalAmountRON).toBe(800);
    expect((result as { creditContributionRON: number }).creditContributionRON).toBe(300);
    expect(prisma.store.jun).toMatchObject({ paidAmountRON: 500, outstandingAmountRON: 0, status: 'PAID' });
    expect(prisma.apartment.creditBalanceRON).toBe(300);
  });

  it('carries the full amount as credit when there are no outstanding invoices at all', async () => {
    const prisma = makePrisma({});
    const service = new PaymentConfirmationsService(prisma as never, makePermissions() as never);

    const result = await service.create(
      { apartmentId: 'apt-1', paymentDate: '2026-07-31', autoApplyAmountRON: 400 } as never,
      makeUser({}),
    );

    expect((result as { totalAmountRON: number }).totalAmountRON).toBe(400);
    expect(prisma.apartment.creditBalanceRON).toBe(400);
  });
});

describe('PaymentConfirmationsService.remove', () => {
  it('un-applies a deleted confirmation from every invoice it touched', async () => {
    const prisma = makePrisma({ inv: makeInvoice({ totalAmountRON: 500, paidAmountRON: 500, outstandingAmountRON: 0, status: 'PAID' }) });
    (prisma.client as unknown as { paymentConfirmation: { findFirst: jest.Mock } }).paymentConfirmation = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'pc-1',
        applications: [{ invoiceId: 'inv', amountRON: 500 }],
      }),
    };
    const service = new PaymentConfirmationsService(prisma as never, makePermissions() as never);

    await service.remove('pc-1');

    expect(prisma.store.inv).toMatchObject({ paidAmountRON: 0, outstandingAmountRON: 500, status: 'UNPAID' });
  });

  it('gives back credit consumed by a deleted CREDIT-method confirmation', async () => {
    const prisma = makePrisma(
      { inv: makeInvoice({ totalAmountRON: 500, paidAmountRON: 300, outstandingAmountRON: 200, status: 'PARTIALLY_PAID' }) },
      { creditBalanceRON: 0 },
    );
    (prisma.client as unknown as { paymentConfirmation: { findFirst: jest.Mock } }).paymentConfirmation = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'pc-1',
        apartmentId: 'apt-1',
        paymentMethod: 'CREDIT',
        totalAmountRON: 300,
        creditContributionRON: 0,
        applications: [{ invoiceId: 'inv', amountRON: 300 }],
      }),
    };
    const service = new PaymentConfirmationsService(prisma as never, makePermissions() as never);

    await service.remove('pc-1');

    expect(prisma.apartment.creditBalanceRON).toBe(300);
  });

  it('takes back credit created by a deleted overpayment confirmation', async () => {
    const prisma = makePrisma(
      { inv: makeInvoice({ totalAmountRON: 500, paidAmountRON: 500, outstandingAmountRON: 0, status: 'PAID' }) },
      { creditBalanceRON: 300 },
    );
    (prisma.client as unknown as { paymentConfirmation: { findFirst: jest.Mock } }).paymentConfirmation = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'pc-1',
        apartmentId: 'apt-1',
        paymentMethod: 'BANK_TRANSFER',
        totalAmountRON: 800,
        creditContributionRON: 300,
        applications: [{ invoiceId: 'inv', amountRON: 500 }],
      }),
    };
    const service = new PaymentConfirmationsService(prisma as never, makePermissions() as never);

    await service.remove('pc-1');

    expect(prisma.apartment.creditBalanceRON).toBe(0);
  });
});
