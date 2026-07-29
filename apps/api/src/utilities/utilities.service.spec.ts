import { NotFoundException } from '@nestjs/common';
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

describe('UtilitiesService.create (consumption calculation)', () => {
  it('computes consumption as currentReading - previousReading when both are given', async () => {
    const prisma = makePrisma();
    prisma.client.apartment.findFirst.mockResolvedValue({ id: 'apt-1', ownerId: 'owner-1' });
    const service = new UtilitiesService(prisma as never, makePermissions() as never);

    const result = await service.create(
      { apartmentId: 'apt-1', utilityType: 'ELECTRICITY', periodMonth: '2026-07-01', previousReading: 100, currentReading: 230 } as never,
      makeUser({}),
    );
    expect(result).toMatchObject({ consumption: 130 });
  });

  it('leaves consumption undefined when only one of the two readings is supplied', async () => {
    const prisma = makePrisma();
    prisma.client.apartment.findFirst.mockResolvedValue({ id: 'apt-1', ownerId: 'owner-1' });
    const service = new UtilitiesService(prisma as never, makePermissions() as never);

    const result = await service.create(
      { apartmentId: 'apt-1', utilityType: 'WATER', periodMonth: '2026-07-01', currentReading: 230 } as never,
      makeUser({}),
    );
    expect(result.consumption).toBeUndefined();
  });

  it('rejects a record for an apartment that does not exist', async () => {
    const prisma = makePrisma();
    prisma.client.apartment.findFirst.mockResolvedValue(null);
    const service = new UtilitiesService(prisma as never, makePermissions() as never);

    await expect(
      service.create({ apartmentId: 'ghost', utilityType: 'GAS', periodMonth: '2026-07-01' } as never, makeUser({})),
    ).rejects.toThrow('Apartment not found');
  });
});

describe('UtilitiesService.update (consumption recalculation)', () => {
  it('recalculates consumption from the existing previousReading when only currentReading is updated', async () => {
    const prisma = makePrisma();
    prisma.client.utilityRecord.findFirst.mockResolvedValue({ id: 'ur-1', previousReading: '100', currentReading: '200' });
    const service = new UtilitiesService(prisma as never, makePermissions() as never);

    const result = await service.update('ur-1', { currentReading: 250 } as never);
    expect(result).toMatchObject({ consumption: 150 });
  });

  it('recalculates consumption from the new previousReading when only that is updated', async () => {
    const prisma = makePrisma();
    prisma.client.utilityRecord.findFirst.mockResolvedValue({ id: 'ur-1', previousReading: '100', currentReading: '200' });
    const service = new UtilitiesService(prisma as never, makePermissions() as never);

    const result = await service.update('ur-1', { previousReading: 120 } as never);
    expect(result).toMatchObject({ consumption: 80 });
  });

  it('throws NotFoundException when updating a record that does not exist', async () => {
    const prisma = makePrisma();
    prisma.client.utilityRecord.findFirst.mockResolvedValue(null);
    const service = new UtilitiesService(prisma as never, makePermissions() as never);

    await expect(service.update('ghost', { currentReading: 10 } as never)).rejects.toThrow(NotFoundException);
  });
});
