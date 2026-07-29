import { NotFoundException } from '@nestjs/common';
import { LeasesService } from './leases.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { id: 'pm-1', roleKey: 'ADMIN', ownerId: null, tenantId: null, tokenVersion: 0, ...overrides };
}

function makePrisma() {
  const tx = {
    lease: {
      create: jest.fn(async (args) => ({ id: 'lease-new', ...args.data })),
      update: jest.fn(async (args) => ({ id: args.where.id, ...args.data })),
    },
    apartment: {
      update: jest.fn(async (args) => ({ id: args.where.id, ...args.data })),
      findFirst: jest.fn(),
    },
  };
  return {
    client: {
      apartment: { findFirst: jest.fn() },
      lease: { findFirst: jest.fn() },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
    },
    forOwnerScope: jest.fn(),
    tx,
  };
}

function makePermissions() {
  return { resolveAllowedOwnerIds: jest.fn().mockResolvedValue('all') };
}

describe('LeasesService.create', () => {
  it('rejects a lease for a non-existent apartment', async () => {
    const prisma = makePrisma();
    prisma.client.apartment.findFirst.mockResolvedValue(null);
    const service = new LeasesService(prisma as never, makePermissions() as never);

    await expect(
      service.create({ apartmentId: 'ghost', tenantId: 't-1', startDate: '2026-01-01', endDate: '2027-01-01', rentAmountEUR: 500, depositAmountEUR: 500 } as never, makeUser({})),
    ).rejects.toThrow('Apartment not found');
  });

  it('marks the apartment OCCUPIED and sets currentLeaseId when created as ACTIVE', async () => {
    const prisma = makePrisma();
    prisma.client.apartment.findFirst.mockResolvedValue({ id: 'apt-1', ownerId: 'owner-1' });
    const service = new LeasesService(prisma as never, makePermissions() as never);

    await service.create(
      { apartmentId: 'apt-1', tenantId: 't-1', startDate: '2026-01-01', endDate: '2027-01-01', rentAmountEUR: 500, depositAmountEUR: 500, status: 'ACTIVE' } as never,
      makeUser({}),
    );

    expect(prisma.tx.apartment.update).toHaveBeenCalledWith({
      where: { id: 'apt-1' },
      data: { currentLeaseId: 'lease-new', status: 'OCCUPIED' },
    });
  });

  it('leaves the apartment untouched when the lease is created as DRAFT (the default)', async () => {
    const prisma = makePrisma();
    prisma.client.apartment.findFirst.mockResolvedValue({ id: 'apt-1', ownerId: 'owner-1' });
    const service = new LeasesService(prisma as never, makePermissions() as never);

    await service.create(
      { apartmentId: 'apt-1', tenantId: 't-1', startDate: '2026-01-01', endDate: '2027-01-01', rentAmountEUR: 500, depositAmountEUR: 500 } as never,
      makeUser({}),
    );

    expect(prisma.tx.apartment.update).not.toHaveBeenCalled();
  });
});

describe('LeasesService.renew', () => {
  it('creates a new lease linked via renewedFromLeaseId, ends the old one, and re-points the apartment', async () => {
    const prisma = makePrisma();
    prisma.client.lease.findFirst.mockResolvedValue({
      id: 'lease-old',
      apartmentId: 'apt-1',
      ownerId: 'owner-1',
      tenantId: 't-1',
      depositAmountEUR: 500,
      depositStatus: 'HELD',
    });
    const service = new LeasesService(prisma as never, makePermissions() as never);

    const result = await service.renew(
      'lease-old',
      { startDate: '2027-01-01', endDate: '2028-01-01', rentAmountEUR: 520 } as never,
      makeUser({}),
    );

    expect(result).toMatchObject({ renewedFromLeaseId: 'lease-old', status: 'ACTIVE' });
    expect(prisma.tx.lease.update).toHaveBeenCalledWith({ where: { id: 'lease-old' }, data: { status: 'ENDED' } });
    expect(prisma.tx.apartment.update).toHaveBeenCalledWith({
      where: { id: 'apt-1' },
      data: { currentLeaseId: 'lease-new', status: 'OCCUPIED' },
    });
  });

  it('carries the deposit forward from the old lease rather than resetting it', async () => {
    const prisma = makePrisma();
    prisma.client.lease.findFirst.mockResolvedValue({
      id: 'lease-old',
      apartmentId: 'apt-1',
      ownerId: 'owner-1',
      tenantId: 't-1',
      depositAmountEUR: 750,
      depositStatus: 'HELD',
    });
    const service = new LeasesService(prisma as never, makePermissions() as never);

    const result = await service.renew(
      'lease-old',
      { startDate: '2027-01-01', endDate: '2028-01-01', rentAmountEUR: 520 } as never,
      makeUser({}),
    );

    expect(result).toMatchObject({ depositAmountEUR: 750, depositStatus: 'HELD' });
  });

  it('throws NotFoundException when renewing a lease that does not exist', async () => {
    const prisma = makePrisma();
    prisma.client.lease.findFirst.mockResolvedValue(null);
    const service = new LeasesService(prisma as never, makePermissions() as never);

    await expect(
      service.renew('ghost', { startDate: '2027-01-01', endDate: '2028-01-01', rentAmountEUR: 500 } as never, makeUser({})),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('LeasesService.terminate', () => {
  it('vacates the apartment when the terminated lease is the current one', async () => {
    const prisma = makePrisma();
    prisma.client.lease.findFirst.mockResolvedValue({ id: 'lease-1', apartmentId: 'apt-1' });
    prisma.tx.apartment.findFirst.mockResolvedValue({ id: 'apt-1', currentLeaseId: 'lease-1' });
    const service = new LeasesService(prisma as never, makePermissions() as never);

    await service.terminate('lease-1', 'tenant relocating');

    expect(prisma.tx.apartment.update).toHaveBeenCalledWith({
      where: { id: 'apt-1' },
      data: { currentLeaseId: null, status: 'VACANT' },
    });
  });

  it('does NOT touch the apartment when terminating a lease that is no longer the current one (e.g. already superseded by a renewal)', async () => {
    const prisma = makePrisma();
    prisma.client.lease.findFirst.mockResolvedValue({ id: 'lease-old', apartmentId: 'apt-1' });
    prisma.tx.apartment.findFirst.mockResolvedValue({ id: 'apt-1', currentLeaseId: 'lease-new-current' });
    const service = new LeasesService(prisma as never, makePermissions() as never);

    await service.terminate('lease-old', 'cleanup');

    expect(prisma.tx.apartment.update).not.toHaveBeenCalled();
  });

  it('sets status TERMINATED and stores the reason', async () => {
    const prisma = makePrisma();
    prisma.client.lease.findFirst.mockResolvedValue({ id: 'lease-1', apartmentId: 'apt-1' });
    prisma.tx.apartment.findFirst.mockResolvedValue({ id: 'apt-1', currentLeaseId: 'lease-1' });
    const service = new LeasesService(prisma as never, makePermissions() as never);

    const result = await service.terminate('lease-1', 'non-payment');

    expect(result).toMatchObject({ status: 'TERMINATED', terminationReason: 'non-payment' });
  });
});
