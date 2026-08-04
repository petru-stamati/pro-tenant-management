import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';

function makeUser(overrides: Partial<AuthenticatedUser>): AuthenticatedUser {
  return { id: 'pm-1', roleKey: 'ADMIN', ownerId: null, tenantId: null, tokenVersion: 0, ...overrides };
}

/** Minimal fake of the PrismaService surface the maintenance service touches. */
function makePrisma(overrides: Record<string, unknown> = {}) {
  const tx = {
    maintenanceRequest: {
      create: jest.fn(async (args) => ({ id: 'req-new', ...args.data })),
      update: jest.fn(async (args) => ({ id: args.where.id, ...args.data })),
    },
    maintenanceStatusEvent: { create: jest.fn() },
    maintenanceProposal: {
      updateMany: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(async (args) => ({ id: 'prop-new', ...args.data })),
      update: jest.fn(),
    },
    roomItem: { update: jest.fn(async (args) => ({ id: args.where.id, ...args.data })) },
  };
  const prisma = {
    client: {
      apartment: { findFirst: jest.fn().mockResolvedValue({ id: 'apt-1', ownerId: 'owner-1' }) },
      lease: { findFirst: jest.fn() },
      maintenanceRequest: { findFirst: jest.fn() },
      maintenanceProposal: { findFirst: jest.fn() },
      maintenanceComment: { findMany: jest.fn(), create: jest.fn() },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
    },
    forOwnerScope: jest.fn(() => ({ maintenanceRequest: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() } })),
    tx,
    ...overrides,
  };
  return prisma;
}

function makePermissions(allowedOwnerIds: string[] | 'all' = 'all') {
  return { resolveAllowedOwnerIds: jest.fn().mockResolvedValue(allowedOwnerIds) };
}

function makeNotifications() {
  return { notifyRole: jest.fn().mockResolvedValue(undefined) };
}

describe('MaintenanceService state machine', () => {
  describe('changeStatus', () => {
    it.each([
      ['REPORTED', 'TRIAGED'],
      ['TRIAGED', 'PROPOSAL_CREATED'],
      ['IN_PROGRESS', 'REPAIRED'],
      ['REPAIRED', 'COMPLETED'],
    ])('allows the manual transition %s -> %s', async (from, to) => {
      const prisma = makePrisma();
      prisma.client.maintenanceRequest.findFirst.mockResolvedValue({ id: 'req-1', status: from });
      const service = new MaintenanceService(prisma as never, makePermissions() as never, makeNotifications() as never);

      await expect(
        service.changeStatus('req-1', { toStatus: to } as never, makeUser({})),
      ).resolves.toBeDefined();
    });

    it.each([
      ['REPORTED', 'PENDING_OWNER_APPROVAL'],
      ['REPORTED', 'IN_PROGRESS'],
      ['REPORTED', 'COMPLETED'],
      ['TRIAGED', 'IN_PROGRESS'],
      ['PENDING_OWNER_APPROVAL', 'IN_PROGRESS'],
      ['COMPLETED', 'IN_PROGRESS'],
      ['CANCELLED', 'TRIAGED'],
    ])('blocks the illegal transition %s -> %s (approval gate cannot be bypassed)', async (from, to) => {
      const prisma = makePrisma();
      prisma.client.maintenanceRequest.findFirst.mockResolvedValue({ id: 'req-1', status: from });
      const service = new MaintenanceService(prisma as never, makePermissions() as never, makeNotifications() as never);

      await expect(
        service.changeStatus('req-1', { toStatus: to } as never, makeUser({})),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for a request that does not exist', async () => {
      const prisma = makePrisma();
      prisma.client.maintenanceRequest.findFirst.mockResolvedValue(null);
      const service = new MaintenanceService(prisma as never, makePermissions() as never, makeNotifications() as never);

      await expect(
        service.changeStatus('ghost', { toStatus: 'TRIAGED' } as never, makeUser({})),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel', () => {
    it.each(['REPORTED', 'TRIAGED', 'PROPOSAL_CREATED', 'PENDING_OWNER_APPROVAL', 'IN_PROGRESS'])(
      'allows cancelling from %s',
      async (status) => {
        const prisma = makePrisma();
        prisma.client.maintenanceRequest.findFirst.mockResolvedValue({ id: 'req-1', status });
        const service = new MaintenanceService(prisma as never, makePermissions() as never, makeNotifications() as never);
        await expect(service.cancel('req-1', 'tenant moved out', makeUser({}))).resolves.toBeDefined();
      },
    );

    it('refuses to cancel a request that is already COMPLETED', async () => {
      const prisma = makePrisma();
      prisma.client.maintenanceRequest.findFirst.mockResolvedValue({ id: 'req-1', status: 'COMPLETED' });
      const service = new MaintenanceService(prisma as never, makePermissions() as never, makeNotifications() as never);
      await expect(service.cancel('req-1', 'too late', makeUser({}))).rejects.toThrow(BadRequestException);
    });

    it('refuses to cancel a request that is already CANCELLED', async () => {
      const prisma = makePrisma();
      prisma.client.maintenanceRequest.findFirst.mockResolvedValue({ id: 'req-1', status: 'CANCELLED' });
      const service = new MaintenanceService(prisma as never, makePermissions() as never, makeNotifications() as never);
      await expect(service.cancel('req-1', 'again', makeUser({}))).rejects.toThrow(BadRequestException);
    });
  });

  describe('createProposal', () => {
    it('requires the request to be TRIAGED or PROPOSAL_CREATED first', async () => {
      const prisma = makePrisma();
      prisma.client.maintenanceRequest.findFirst.mockResolvedValue({ id: 'req-1', status: 'REPORTED' });
      const service = new MaintenanceService(prisma as never, makePermissions() as never, makeNotifications() as never);
      await expect(
        service.createProposal('req-1', { contractorName: 'X', description: 'y', costEUR: 10 } as never, makeUser({})),
      ).rejects.toThrow(BadRequestException);
    });

    it('moves the request straight to PENDING_OWNER_APPROVAL once a proposal is attached', async () => {
      const prisma = makePrisma();
      prisma.client.maintenanceRequest.findFirst.mockResolvedValue({ id: 'req-1', status: 'TRIAGED' });
      const service = new MaintenanceService(prisma as never, makePermissions() as never, makeNotifications() as never);
      await service.createProposal(
        'req-1',
        { contractorName: 'Ionescu SRL', description: 'fix it', costEUR: 100 } as never,
        makeUser({}),
      );
      expect(prisma.tx.maintenanceRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'req-1' }, data: { status: 'PENDING_OWNER_APPROVAL' } }),
      );
    });

    it('supersedes any still-pending proposal when a revised quote is attached', async () => {
      const prisma = makePrisma();
      prisma.client.maintenanceRequest.findFirst.mockResolvedValue({ id: 'req-1', status: 'PROPOSAL_CREATED' });
      const service = new MaintenanceService(prisma as never, makePermissions() as never, makeNotifications() as never);
      await service.createProposal(
        'req-1',
        { contractorName: 'Second SRL', description: 'revised', costEUR: 150 } as never,
        makeUser({}),
      );
      expect(prisma.tx.maintenanceProposal.updateMany).toHaveBeenCalledWith({
        where: { maintenanceRequestId: 'req-1', status: 'PENDING' },
        data: { status: 'SUPERSEDED' },
      });
    });
  });

  describe('decideProposal', () => {
    it('rejects a decision on a request the caller cannot see (owner-scope enforced)', async () => {
      const prisma = makePrisma();
      const scoped = { maintenanceRequest: { findFirst: jest.fn().mockResolvedValue(null) } };
      (prisma.forOwnerScope as jest.Mock).mockReturnValue(scoped);
      const service = new MaintenanceService(prisma as never, makePermissions(['owner-1']) as never, makeNotifications() as never);

      await expect(
        service.decideProposal('req-1', 'prop-1', 'APPROVED', makeUser({ roleKey: 'OWNER', ownerId: 'owner-1' })),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a decision when the request is not awaiting approval', async () => {
      const prisma = makePrisma();
      const scoped = {
        maintenanceRequest: { findFirst: jest.fn().mockResolvedValue({ id: 'req-1', status: 'IN_PROGRESS' }) },
      };
      (prisma.forOwnerScope as jest.Mock).mockReturnValue(scoped);
      const service = new MaintenanceService(prisma as never, makePermissions(['owner-1']) as never, makeNotifications() as never);

      await expect(
        service.decideProposal('req-1', 'prop-1', 'APPROVED', makeUser({ roleKey: 'OWNER', ownerId: 'owner-1' })),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects deciding on a proposal that is no longer PENDING (already superseded)', async () => {
      const prisma = makePrisma();
      const scoped = {
        maintenanceRequest: {
          findFirst: jest.fn().mockResolvedValue({ id: 'req-1', status: 'PENDING_OWNER_APPROVAL' }),
        },
      };
      (prisma.forOwnerScope as jest.Mock).mockReturnValue(scoped);
      prisma.client.maintenanceProposal.findFirst.mockResolvedValue({ id: 'prop-1', status: 'SUPERSEDED' });
      const service = new MaintenanceService(prisma as never, makePermissions(['owner-1']) as never, makeNotifications() as never);

      await expect(
        service.decideProposal('req-1', 'prop-1', 'APPROVED', makeUser({ roleKey: 'OWNER', ownerId: 'owner-1' })),
      ).rejects.toThrow(BadRequestException);
    });

    it('moves the request to IN_PROGRESS on APPROVED', async () => {
      const prisma = makePrisma();
      const scoped = {
        maintenanceRequest: {
          findFirst: jest.fn().mockResolvedValue({ id: 'req-1', status: 'PENDING_OWNER_APPROVAL' }),
        },
      };
      (prisma.forOwnerScope as jest.Mock).mockReturnValue(scoped);
      prisma.client.maintenanceProposal.findFirst.mockResolvedValue({ id: 'prop-1', status: 'PENDING' });
      const service = new MaintenanceService(prisma as never, makePermissions(['owner-1']) as never, makeNotifications() as never);

      const result = await service.decideProposal(
        'req-1',
        'prop-1',
        'APPROVED',
        makeUser({ roleKey: 'OWNER', ownerId: 'owner-1' }),
      );
      expect(result).toMatchObject({ status: 'IN_PROGRESS' });
    });

    it('sends the request back to TRIAGED on REJECTED, not CANCELLED or terminal', async () => {
      const prisma = makePrisma();
      const scoped = {
        maintenanceRequest: {
          findFirst: jest.fn().mockResolvedValue({ id: 'req-1', status: 'PENDING_OWNER_APPROVAL' }),
        },
      };
      (prisma.forOwnerScope as jest.Mock).mockReturnValue(scoped);
      prisma.client.maintenanceProposal.findFirst.mockResolvedValue({ id: 'prop-1', status: 'PENDING' });
      const service = new MaintenanceService(prisma as never, makePermissions(['owner-1']) as never, makeNotifications() as never);

      const result = await service.decideProposal(
        'req-1',
        'prop-1',
        'REJECTED',
        makeUser({ roleKey: 'OWNER', ownerId: 'owner-1' }),
      );
      expect(result).toMatchObject({ status: 'TRIAGED' });
    });
  });

  describe('tenant access boundaries', () => {
    it('create() forbids a tenant from reporting an issue on an apartment they have no lease on', async () => {
      const prisma = makePrisma();
      prisma.client.maintenanceRequest.findFirst.mockResolvedValue(null);
      (prisma.client as never as { apartment: unknown }).apartment = {
        findFirst: jest.fn().mockResolvedValue({ id: 'apt-1', ownerId: 'owner-1' }),
      };
      (prisma.client as never as { lease: unknown }).lease = { findFirst: jest.fn().mockResolvedValue(null) };
      const service = new MaintenanceService(prisma as never, makePermissions() as never, makeNotifications() as never);

      await expect(
        service.create(
          { apartmentId: 'apt-1', title: 'x', description: 'y' } as never,
          makeUser({ roleKey: 'TENANT', tenantId: 'tenant-1' }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('listComments hides internal (non-tenant-visible) comments from a TENANT caller', async () => {
      const prisma = makePrisma();
      prisma.client.maintenanceRequest.findFirst.mockResolvedValue({
        id: 'req-1',
        apartment: { leases: [{ tenantId: 'tenant-1' }] },
      });
      const findMany = jest.fn().mockResolvedValue([]);
      prisma.client.maintenanceComment.findMany = findMany;
      const service = new MaintenanceService(prisma as never, makePermissions() as never, makeNotifications() as never);

      await service.listComments(makeUser({ roleKey: 'TENANT', tenantId: 'tenant-1' }), 'req-1');

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ visibleToTenant: true }) }),
      );
    });

    it('listComments does not filter by visibility for PM/owner callers', async () => {
      const prisma = makePrisma();
      const scoped = {
        maintenanceRequest: {
          findFirst: jest.fn().mockResolvedValue({ id: 'req-1' }),
        },
      };
      (prisma.forOwnerScope as jest.Mock).mockReturnValue(scoped);
      const findMany = jest.fn().mockResolvedValue([]);
      prisma.client.maintenanceComment.findMany = findMany;
      const service = new MaintenanceService(prisma as never, makePermissions() as never, makeNotifications() as never);

      await service.listComments(makeUser({ roleKey: 'ADMIN' }), 'req-1');

      const calledWith = findMany.mock.calls[0][0];
      expect(calledWith.where.visibleToTenant).toBeUndefined();
    });
  });

  describe('create — room item linking', () => {
    it('marks the linked item NEEDS_ATTENTION when reported via "report a problem"', async () => {
      const prisma = makePrisma();
      const service = new MaintenanceService(prisma as never, makePermissions() as never, makeNotifications() as never);

      await service.create(
        { apartmentId: 'apt-1', title: 'Dishwasher leaking', description: 'y', roomItemId: 'item-1' } as never,
        makeUser({}),
      );

      expect(prisma.tx.maintenanceRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ roomItemId: 'item-1' }) }),
      );
      expect(prisma.tx.roomItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { condition: 'NEEDS_ATTENTION', conditionNote: 'Dishwasher leaking' },
      });
    });

    it('does not touch any room item when reported without one', async () => {
      const prisma = makePrisma();
      const service = new MaintenanceService(prisma as never, makePermissions() as never, makeNotifications() as never);

      await service.create({ apartmentId: 'apt-1', title: 'x', description: 'y' } as never, makeUser({}));

      expect(prisma.tx.roomItem.update).not.toHaveBeenCalled();
    });
  });

  describe('changeStatus — room item resolution', () => {
    it('resets the linked item back to GOOD when the request completes', async () => {
      const prisma = makePrisma();
      prisma.client.maintenanceRequest.findFirst.mockResolvedValue({ id: 'req-1', status: 'REPAIRED', roomItemId: 'item-1' });
      const service = new MaintenanceService(prisma as never, makePermissions() as never, makeNotifications() as never);

      await service.changeStatus('req-1', { toStatus: 'COMPLETED' } as never, makeUser({}));

      expect(prisma.tx.roomItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { condition: 'GOOD', conditionNote: null },
      });
    });

    it('does not touch a room item when the request has none', async () => {
      const prisma = makePrisma();
      prisma.client.maintenanceRequest.findFirst.mockResolvedValue({ id: 'req-1', status: 'REPAIRED', roomItemId: null });
      const service = new MaintenanceService(prisma as never, makePermissions() as never, makeNotifications() as never);

      await service.changeStatus('req-1', { toStatus: 'COMPLETED' } as never, makeUser({}));

      expect(prisma.tx.roomItem.update).not.toHaveBeenCalled();
    });
  });
});
