import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ApartmentInvoicesService } from './apartment-invoices.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { id: 'pm-1', roleKey: 'ADMIN', ownerId: null, tenantId: null, tokenVersion: 0, ...overrides };
}

function makePrisma() {
  const tx = {
    apartmentInvoice: {
      create: jest.fn(async (args: { data: Record<string, unknown> }) => ({ id: 'inv-new', ...args.data })),
    },
    paymentConfirmation: {
      create: jest.fn(async (args: { data: Record<string, unknown> }) => ({ id: 'pc-credit', ...args.data })),
    },
    apartment: {
      update: jest.fn(async (args: { data: Record<string, unknown> }) => args.data),
    },
  };
  return {
    client: {
      apartment: { findFirst: jest.fn() },
      apartmentInvoice: {
        findFirst: jest.fn(),
        create: jest.fn(async (args: { data: Record<string, unknown> }) => ({ id: 'inv-new', ...args.data })),
        update: jest.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
          id: args.where.id,
          ...args.data,
        })),
        delete: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
    },
    forOwnerScope: jest.fn(),
    tx,
  };
}

function makePermissions() {
  return { resolveAllowedOwnerIds: jest.fn().mockResolvedValue('all') };
}

describe('ApartmentInvoicesService.create', () => {
  it('rejects an invoice for a non-existent apartment', async () => {
    const prisma = makePrisma();
    prisma.client.apartment.findFirst.mockResolvedValue(null);
    const service = new ApartmentInvoicesService(prisma as never, makePermissions() as never);

    await expect(
      service.create(
        {
          apartmentId: 'ghost',
          type: 'RENT',
          issueDate: '2026-07-01',
          dueDate: '2026-07-10',
          periodMonth: '2026-07-01',
          totalAmountRON: 1000,
        } as never,
        makeUser({}),
      ),
    ).rejects.toThrow('Apartment not found');
  });

  it('sets outstandingAmountRON to the full total and status UNPAID on a new invoice', async () => {
    const prisma = makePrisma();
    prisma.client.apartment.findFirst.mockResolvedValue({ id: 'apt-1', ownerId: 'owner-1' });
    const service = new ApartmentInvoicesService(prisma as never, makePermissions() as never);

    await service.create(
      {
        apartmentId: 'apt-1',
        type: 'RENT_AND_UTILITIES',
        issueDate: '2026-07-01',
        dueDate: '2026-07-10',
        periodMonth: '2026-07-01',
        totalAmountRON: 1200,
      } as never,
      makeUser({}),
    );

    expect(prisma.client.apartmentInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ownerId: 'owner-1', totalAmountRON: 1200, outstandingAmountRON: 1200 }),
      }),
    );
  });

  it('auto-consumes a standing credit balance against a new invoice and records it as a CREDIT payment', async () => {
    const prisma = makePrisma();
    prisma.client.apartment.findFirst.mockResolvedValue({ id: 'apt-1', ownerId: 'owner-1', creditBalanceRON: 300 });
    const service = new ApartmentInvoicesService(prisma as never, makePermissions() as never);

    const invoice = await service.create(
      {
        apartmentId: 'apt-1',
        type: 'RENT',
        issueDate: '2026-07-01',
        dueDate: '2026-07-10',
        periodMonth: '2026-07-01',
        totalAmountRON: 1000,
      } as never,
      makeUser({}),
    );

    expect((invoice as { paidAmountRON: number }).paidAmountRON).toBe(300);
    expect((invoice as { outstandingAmountRON: number }).outstandingAmountRON).toBe(700);
    expect((invoice as { status: string }).status).toBe('PARTIALLY_PAID');
    expect(prisma.tx.paymentConfirmation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentMethod: 'CREDIT', totalAmountRON: 300 }),
      }),
    );
    expect(prisma.tx.apartment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { creditBalanceRON: { decrement: 300 } } }),
    );
  });

  it('fully pays a new invoice from credit when the credit balance covers it entirely', async () => {
    const prisma = makePrisma();
    prisma.client.apartment.findFirst.mockResolvedValue({ id: 'apt-1', ownerId: 'owner-1', creditBalanceRON: 5000 });
    const service = new ApartmentInvoicesService(prisma as never, makePermissions() as never);

    const invoice = await service.create(
      {
        apartmentId: 'apt-1',
        type: 'RENT',
        issueDate: '2026-07-01',
        dueDate: '2026-07-10',
        periodMonth: '2026-07-01',
        totalAmountRON: 1000,
      } as never,
      makeUser({}),
    );

    expect((invoice as { outstandingAmountRON: number }).outstandingAmountRON).toBe(0);
    expect((invoice as { status: string }).status).toBe('PAID');
    expect(prisma.tx.apartment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { creditBalanceRON: { decrement: 1000 } } }),
    );
  });
});

describe('ApartmentInvoicesService.update', () => {
  it('throws when a corrected total would be less than what is already paid', async () => {
    const prisma = makePrisma();
    prisma.client.apartmentInvoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      totalAmountRON: 1000,
      paidAmountRON: 600,
    });
    const service = new ApartmentInvoicesService(prisma as never, makePermissions() as never);

    await expect(service.update('inv-1', { totalAmountRON: 500 } as never)).rejects.toThrow(BadRequestException);
  });

  it('recomputes outstanding and flips status to PARTIALLY_PAID when a corrected total still exceeds what is paid', async () => {
    const prisma = makePrisma();
    prisma.client.apartmentInvoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      totalAmountRON: 1000,
      paidAmountRON: 600,
    });
    const service = new ApartmentInvoicesService(prisma as never, makePermissions() as never);

    await service.update('inv-1', { totalAmountRON: 900 } as never);

    expect(prisma.client.apartmentInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ outstandingAmountRON: 300, status: 'PARTIALLY_PAID' }),
      }),
    );
  });

  it('throws NotFoundException for a missing invoice', async () => {
    const prisma = makePrisma();
    prisma.client.apartmentInvoice.findFirst.mockResolvedValue(null);
    const service = new ApartmentInvoicesService(prisma as never, makePermissions() as never);

    await expect(service.update('ghost', {} as never)).rejects.toThrow(NotFoundException);
  });
});
