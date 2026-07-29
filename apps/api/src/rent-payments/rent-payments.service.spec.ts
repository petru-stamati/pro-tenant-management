import { BadRequestException } from '@nestjs/common';
import { RentPaymentsService } from './rent-payments.service';

function makePrisma() {
  return {
    client: {
      lease: { findFirst: jest.fn() },
      rentPayment: { create: jest.fn((args) => ({ id: 'rp-1', ...args.data })), update: jest.fn((args) => ({ id: args.where.id, ...args.data })), findFirst: jest.fn() },
      invoice: { create: jest.fn((args) => ({ id: 'inv-1', ...args.data })) },
    },
    forOwnerScope: jest.fn(),
  };
}

function makePermissions() {
  return { resolveAllowedOwnerIds: jest.fn().mockResolvedValue('all') };
}

describe('RentPaymentsService.recordPayment (status classification)', () => {
  it('marks PAID when the full rent amount is paid', async () => {
    const prisma = makePrisma();
    prisma.client.rentPayment.findFirst.mockResolvedValue({ id: 'rp-1', rentAmountEUR: '500', dueDate: new Date('2099-01-01'), notes: null });
    const service = new RentPaymentsService(prisma as never, makePermissions() as never, {} as never);

    const result = await service.recordPayment('rp-1', { paidAmountEUR: 500 } as never);
    expect(result).toMatchObject({ status: 'PAID', outstandingAmountEUR: 0 });
  });

  it('marks PAID when overpaid (outstanding floors at zero, never negative)', async () => {
    const prisma = makePrisma();
    prisma.client.rentPayment.findFirst.mockResolvedValue({ id: 'rp-1', rentAmountEUR: '500', dueDate: new Date('2099-01-01'), notes: null });
    const service = new RentPaymentsService(prisma as never, makePermissions() as never, {} as never);

    const result = await service.recordPayment('rp-1', { paidAmountEUR: 600 } as never);
    expect(result).toMatchObject({ status: 'PAID', outstandingAmountEUR: 0 });
  });

  it('marks PARTIALLY_PAID when some but not all of the rent is paid', async () => {
    const prisma = makePrisma();
    prisma.client.rentPayment.findFirst.mockResolvedValue({ id: 'rp-1', rentAmountEUR: '500', dueDate: new Date('2099-01-01'), notes: null });
    const service = new RentPaymentsService(prisma as never, makePermissions() as never, {} as never);

    const result = await service.recordPayment('rp-1', { paidAmountEUR: 200 } as never);
    expect(result).toMatchObject({ status: 'PARTIALLY_PAID', outstandingAmountEUR: 300 });
  });

  it('marks LATE when nothing has been paid and the due date has passed', async () => {
    const prisma = makePrisma();
    prisma.client.rentPayment.findFirst.mockResolvedValue({ id: 'rp-1', rentAmountEUR: '500', dueDate: new Date('2020-01-01'), notes: null });
    const service = new RentPaymentsService(prisma as never, makePermissions() as never, {} as never);

    const result = await service.recordPayment('rp-1', { paidAmountEUR: 0 } as never);
    expect(result).toMatchObject({ status: 'LATE' });
  });

  it('marks UNPAID when nothing has been paid and the due date is still in the future', async () => {
    const prisma = makePrisma();
    prisma.client.rentPayment.findFirst.mockResolvedValue({ id: 'rp-1', rentAmountEUR: '500', dueDate: new Date('2099-01-01'), notes: null });
    const service = new RentPaymentsService(prisma as never, makePermissions() as never, {} as never);

    const result = await service.recordPayment('rp-1', { paidAmountEUR: 0 } as never);
    expect(result).toMatchObject({ status: 'UNPAID' });
  });

  it('preserves the existing notes when none are supplied in the update', async () => {
    const prisma = makePrisma();
    prisma.client.rentPayment.findFirst.mockResolvedValue({ id: 'rp-1', rentAmountEUR: '500', dueDate: new Date('2099-01-01'), notes: 'original note' });
    const service = new RentPaymentsService(prisma as never, makePermissions() as never, {} as never);

    const result = await service.recordPayment('rp-1', { paidAmountEUR: 500 } as never);
    expect(result).toMatchObject({ notes: 'original note' });
  });
});

describe('RentPaymentsService.generateInvoice (FX snapshot)', () => {
  it('refuses to generate a second invoice for the same rent payment', async () => {
    const prisma = makePrisma();
    prisma.client.rentPayment.findFirst.mockResolvedValue({
      id: 'rp-1',
      invoice: { id: 'inv-existing' },
      lease: { tenantId: 't-1' },
    });
    const service = new RentPaymentsService(prisma as never, makePermissions() as never, {} as never);

    await expect(service.generateInvoice('rp-1')).rejects.toThrow(BadRequestException);
  });

  it('snapshots the exchange rate and computes amountRON = amountEUR * rateRON, rounded to 2 decimals', async () => {
    const prisma = makePrisma();
    prisma.client.rentPayment.findFirst.mockResolvedValue({
      id: 'rp-1',
      invoice: null,
      leaseId: 'lease-1',
      apartmentId: 'apt-1',
      ownerId: 'owner-1',
      rentAmountEUR: '480',
      dueDate: new Date('2026-08-01'),
      lease: { tenantId: 't-1' },
    });
    const exchangeRates = { getRateForDate: jest.fn().mockResolvedValue({ rateRON: '4.976' }) };
    const service = new RentPaymentsService(prisma as never, makePermissions() as never, exchangeRates as never);

    const result = await service.generateInvoice('rp-1');

    // 480 * 4.976 = 2388.48
    expect(result).toMatchObject({ amountEUR: 480, exchangeRateRON: '4.976', amountRON: 2388.48 });
  });

  it('rounds amountRON to the nearest cent rather than truncating', async () => {
    const prisma = makePrisma();
    prisma.client.rentPayment.findFirst.mockResolvedValue({
      id: 'rp-1',
      invoice: null,
      leaseId: 'lease-1',
      apartmentId: 'apt-1',
      ownerId: 'owner-1',
      rentAmountEUR: '333',
      dueDate: new Date('2026-08-01'),
      lease: { tenantId: 't-1' },
    });
    const exchangeRates = { getRateForDate: jest.fn().mockResolvedValue({ rateRON: '4.9999' }) };
    const service = new RentPaymentsService(prisma as never, makePermissions() as never, exchangeRates as never);

    const result = await service.generateInvoice('rp-1');

    // 333 * 4.9999 = 1664.9667 -> rounds to 1664.97
    expect(result).toMatchObject({ amountRON: 1664.97 });
  });
});
