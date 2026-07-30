import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UtilitiesService } from './utilities.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { id: 'pm-1', roleKey: 'ADMIN', ownerId: null, tenantId: null, tokenVersion: 0, ...overrides };
}

function makePrisma() {
  return {
    client: {
      apartment: { findFirst: jest.fn() },
      utilityRecord: {
        create: jest.fn((args) => ({ id: 'ur-1', ...args.data })),
        update: jest.fn((args) => ({ id: args.where.id, ...args.data })),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
    },
    forOwnerScope: jest.fn(),
  };
}

function makePermissions() {
  return { resolveAllowedOwnerIds: jest.fn().mockResolvedValue('all') };
}

function makeRates(rate: unknown = null) {
  return { findForOwnerAndType: jest.fn().mockResolvedValue(rate) };
}

describe('UtilitiesService.create (consumption calculation)', () => {
  it('computes consumption as currentReading - previousReading when both are given', async () => {
    const prisma = makePrisma();
    prisma.client.apartment.findFirst.mockResolvedValue({ id: 'apt-1', ownerId: 'owner-1' });
    const service = new UtilitiesService(prisma as never, makePermissions() as never, makeRates() as never);

    const result = await service.create(
      {
        apartmentId: 'apt-1',
        utilityType: 'ELECTRICITY',
        periodMonth: '2026-07-01',
        previousReading: 100,
        currentReading: 230,
        invoiceAmountRON: 50,
      } as never,
      makeUser({}),
    );
    expect(result).toMatchObject({ consumption: 130 });
  });

  it('leaves consumption undefined when only one of the two readings is supplied (amount given explicitly)', async () => {
    const prisma = makePrisma();
    prisma.client.apartment.findFirst.mockResolvedValue({ id: 'apt-1', ownerId: 'owner-1' });
    const service = new UtilitiesService(prisma as never, makePermissions() as never, makeRates() as never);

    const result = await service.create(
      { apartmentId: 'apt-1', utilityType: 'HEATING', periodMonth: '2026-07-01', currentReading: 230, invoiceAmountRON: 50 } as never,
      makeUser({}),
    );
    expect(result.consumption).toBeUndefined();
  });

  it('rejects a record for an apartment that does not exist', async () => {
    const prisma = makePrisma();
    prisma.client.apartment.findFirst.mockResolvedValue(null);
    const service = new UtilitiesService(prisma as never, makePermissions() as never, makeRates() as never);

    await expect(
      service.create({ apartmentId: 'ghost', utilityType: 'GAS', periodMonth: '2026-07-01' } as never, makeUser({})),
    ).rejects.toThrow('Apartment not found');
  });

  it('rejects when neither both readings nor an explicit amount are given', async () => {
    const prisma = makePrisma();
    prisma.client.apartment.findFirst.mockResolvedValue({ id: 'apt-1', ownerId: 'owner-1' });
    const service = new UtilitiesService(prisma as never, makePermissions() as never, makeRates() as never);

    await expect(
      service.create(
        { apartmentId: 'apt-1', utilityType: 'ELECTRICITY', periodMonth: '2026-07-01', currentReading: 230 } as never,
        makeUser({}),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects auto-calculation when no rate is configured for that owner/utility type', async () => {
    const prisma = makePrisma();
    prisma.client.apartment.findFirst.mockResolvedValue({ id: 'apt-1', ownerId: 'owner-1' });
    const service = new UtilitiesService(prisma as never, makePermissions() as never, makeRates(null) as never);

    await expect(
      service.create(
        { apartmentId: 'apt-1', utilityType: 'ELECTRICITY', periodMonth: '2026-07-01', previousReading: 100, currentReading: 130 } as never,
        makeUser({}),
      ),
    ).rejects.toThrow('No rate configured');
  });

  it('auto-calculates ELECTRICITY: consumption * pricePerUnit', async () => {
    const prisma = makePrisma();
    prisma.client.apartment.findFirst.mockResolvedValue({ id: 'apt-1', ownerId: 'owner-1' });
    const rates = makeRates({ pricePerUnit: '1.57' });
    const service = new UtilitiesService(prisma as never, makePermissions() as never, rates as never);

    const result = await service.create(
      { apartmentId: 'apt-1', utilityType: 'ELECTRICITY', periodMonth: '2026-07-01', previousReading: 3456, currentReading: 3457 } as never,
      makeUser({}),
    );
    // 1 kWh * 1.57 = 1.57 RON (matches the PM's worked example)
    expect(result).toMatchObject({ invoiceAmountRON: 1.57 });
  });

  it('auto-calculates GAS: consumption * conversionFactor * pricePerUnit', async () => {
    const prisma = makePrisma();
    prisma.client.apartment.findFirst.mockResolvedValue({ id: 'apt-1', ownerId: 'owner-1' });
    const rates = makeRates({ pricePerUnit: '0.24', conversionFactor: '10.79' });
    const service = new UtilitiesService(prisma as never, makePermissions() as never, rates as never);

    const result = await service.create(
      { apartmentId: 'apt-1', utilityType: 'GAS', periodMonth: '2026-07-01', previousReading: 3456, currentReading: 3480 } as never,
      makeUser({}),
    );
    // 24 m3 * 10.79 * 0.24 = 62.1504 -> 62.15 RON (matches the PM's worked example)
    expect(result).toMatchObject({ invoiceAmountRON: 62.15 });
  });

  it('auto-calculates WATER: usage charge + VAT, plus a separately-VATed maintenance fee', async () => {
    const prisma = makePrisma();
    prisma.client.apartment.findFirst.mockResolvedValue({ id: 'apt-1', ownerId: 'owner-1' });
    const rates = makeRates({
      pricePerUnit: '6.3',
      vatPercent: '11',
      maintenanceFee: '4.95',
      maintenanceVatPercent: '21',
    });
    const service = new UtilitiesService(prisma as never, makePermissions() as never, rates as never);

    const result = await service.create(
      { apartmentId: 'apt-1', utilityType: 'COLD_WATER', periodMonth: '2026-07-01', previousReading: 100, currentReading: 105 } as never,
      makeUser({}),
    );
    // (5 * 6.3 * 1.11) + (4.95 * 1.21) = 34.965 + 5.9895 = 40.9545 -> 40.95 RON (matches the PM's worked example)
    expect(result).toMatchObject({ invoiceAmountRON: 40.95 });
  });

  it('an explicit invoiceAmountRON always wins over auto-calculation', async () => {
    const prisma = makePrisma();
    prisma.client.apartment.findFirst.mockResolvedValue({ id: 'apt-1', ownerId: 'owner-1' });
    const rates = makeRates({ pricePerUnit: '1.57' });
    const service = new UtilitiesService(prisma as never, makePermissions() as never, rates as never);

    const result = await service.create(
      {
        apartmentId: 'apt-1',
        utilityType: 'ELECTRICITY',
        periodMonth: '2026-07-01',
        previousReading: 3456,
        currentReading: 3457,
        invoiceAmountRON: 999,
      } as never,
      makeUser({}),
    );
    expect(result).toMatchObject({ invoiceAmountRON: 999 });
    expect(rates.findForOwnerAndType).not.toHaveBeenCalled();
  });
});

describe('UtilitiesService.update (consumption recalculation)', () => {
  it('recalculates consumption from the existing previousReading when only currentReading is updated', async () => {
    const prisma = makePrisma();
    prisma.client.utilityRecord.findFirst.mockResolvedValue({
      id: 'ur-1',
      ownerId: 'owner-1',
      utilityType: 'ELECTRICITY',
      previousReading: '100',
      currentReading: '200',
    });
    const service = new UtilitiesService(prisma as never, makePermissions() as never, makeRates() as never);

    const result = await service.update('ur-1', { currentReading: 250 } as never);
    expect(result).toMatchObject({ consumption: 150 });
  });

  it('recalculates consumption from the new previousReading when only that is updated', async () => {
    const prisma = makePrisma();
    prisma.client.utilityRecord.findFirst.mockResolvedValue({
      id: 'ur-1',
      ownerId: 'owner-1',
      utilityType: 'ELECTRICITY',
      previousReading: '100',
      currentReading: '200',
    });
    const service = new UtilitiesService(prisma as never, makePermissions() as never, makeRates() as never);

    const result = await service.update('ur-1', { previousReading: 120 } as never);
    expect(result).toMatchObject({ consumption: 80 });
  });

  it('re-runs the rate calculation when a reading changes and no explicit amount is given', async () => {
    const prisma = makePrisma();
    prisma.client.utilityRecord.findFirst.mockResolvedValue({
      id: 'ur-1',
      ownerId: 'owner-1',
      utilityType: 'ELECTRICITY',
      previousReading: '3456',
      currentReading: '3456',
    });
    const rates = makeRates({ pricePerUnit: '1.57' });
    const service = new UtilitiesService(prisma as never, makePermissions() as never, rates as never);

    const result = await service.update('ur-1', { currentReading: 3457 } as never);
    expect(result).toMatchObject({ invoiceAmountRON: 1.57 });
  });

  it('never overwrites an explicitly-provided amount with a recalculated one', async () => {
    const prisma = makePrisma();
    prisma.client.utilityRecord.findFirst.mockResolvedValue({
      id: 'ur-1',
      ownerId: 'owner-1',
      utilityType: 'ELECTRICITY',
      previousReading: '3456',
      currentReading: '3456',
    });
    const rates = makeRates({ pricePerUnit: '1.57' });
    const service = new UtilitiesService(prisma as never, makePermissions() as never, rates as never);

    const result = await service.update('ur-1', { currentReading: 3457, invoiceAmountRON: 5 } as never);
    expect(result).toMatchObject({ invoiceAmountRON: 5 });
  });

  it('does not touch the amount at all when no reading changed (e.g. just marking it paid)', async () => {
    const prisma = makePrisma();
    prisma.client.utilityRecord.findFirst.mockResolvedValue({
      id: 'ur-1',
      ownerId: 'owner-1',
      utilityType: 'ELECTRICITY',
      previousReading: '3456',
      currentReading: '3457',
    });
    const rates = makeRates({ pricePerUnit: '1.57' });
    const service = new UtilitiesService(prisma as never, makePermissions() as never, rates as never);

    const result = await service.update('ur-1', { paymentStatus: 'PAID' } as never);
    expect(result.invoiceAmountRON).toBeUndefined();
    expect(rates.findForOwnerAndType).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when updating a record that does not exist', async () => {
    const prisma = makePrisma();
    prisma.client.utilityRecord.findFirst.mockResolvedValue(null);
    const service = new UtilitiesService(prisma as never, makePermissions() as never, makeRates() as never);

    await expect(service.update('ghost', { currentReading: 10 } as never)).rejects.toThrow(NotFoundException);
  });
});
