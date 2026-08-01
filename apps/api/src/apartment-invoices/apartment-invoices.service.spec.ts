import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ApartmentInvoicesService } from './apartment-invoices.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { id: 'pm-1', roleKey: 'ADMIN', ownerId: null, tenantId: null, tokenVersion: 0, ...overrides };
}

function makePrisma() {
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
    },
    forOwnerScope: jest.fn(),
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
