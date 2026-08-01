import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { id: 'pm-1', roleKey: 'ADMIN', ownerId: null, tenantId: null, tokenVersion: 0, ...overrides };
}

function makePrisma() {
  return {
    client: {
      apartment: { findFirst: jest.fn() },
      task: {
        create: jest.fn((args) => ({ id: 'task-1', ...args.data })),
        update: jest.fn((args) => ({ id: args.where.id, ...args.data })),
        findFirst: jest.fn(),
      },
      taskComment: {
        create: jest.fn((args) => ({ id: 'comment-1', ...args.data })),
      },
    },
    forOwnerScope: jest.fn(),
  };
}

function makePermissions(allowedOwnerIds: string[] | 'all' = 'all') {
  return { resolveAllowedOwnerIds: jest.fn().mockResolvedValue(allowedOwnerIds) };
}

describe('TasksService.create', () => {
  it('forces assignedToRole to ADMIN and ownerId to the caller own owner when an Owner creates a task', async () => {
    const prisma = makePrisma();
    const service = new TasksService(prisma as never, makePermissions() as never);

    await service.create(
      { ownerId: 'someone-elses-owner-id', title: 'Please fix the boiler', description: 'It leaks', assignedToRole: 'OWNER' } as never,
      makeUser({ roleKey: 'OWNER', ownerId: 'owner-1' }),
    );

    expect(prisma.client.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ownerId: 'owner-1', assignedToRole: 'ADMIN' }),
      }),
    );
  });

  it('rejects an Owner-created task when the account has no linked owner company', async () => {
    const prisma = makePrisma();
    const service = new TasksService(prisma as never, makePermissions() as never);

    await expect(
      service.create(
        { title: 'x', description: 'y' } as never,
        makeUser({ roleKey: 'OWNER', ownerId: null }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('requires an explicit ownerId when a PM creates a task, and defaults assignment to OWNER', async () => {
    const prisma = makePrisma();
    const service = new TasksService(prisma as never, makePermissions() as never);

    await expect(
      service.create({ title: 'x', description: 'y' } as never, makeUser({ roleKey: 'ADMIN' })),
    ).rejects.toThrow(BadRequestException);

    await service.create(
      { ownerId: 'owner-1', title: 'Approve the invoice correction', description: 'See attached' } as never,
      makeUser({ roleKey: 'ADMIN' }),
    );
    expect(prisma.client.task.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ownerId: 'owner-1', assignedToRole: 'OWNER' }) }),
    );
  });

  it('lets a PM direct a task at themselves (ADMIN) instead of the Owner', async () => {
    const prisma = makePrisma();
    const service = new TasksService(prisma as never, makePermissions() as never);

    await service.create(
      { ownerId: 'owner-1', title: 'Follow up with contractor', description: 'x', assignedToRole: 'ADMIN' } as never,
      makeUser({ roleKey: 'ADMIN' }),
    );
    expect(prisma.client.task.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assignedToRole: 'ADMIN' }) }),
    );
  });

  it('rejects an apartment that belongs to a different owner than the task', async () => {
    const prisma = makePrisma();
    prisma.client.apartment.findFirst.mockResolvedValue({ id: 'apt-1', ownerId: 'owner-2' });
    const service = new TasksService(prisma as never, makePermissions() as never);

    await expect(
      service.create(
        { ownerId: 'owner-1', apartmentId: 'apt-1', title: 'x', description: 'y' } as never,
        makeUser({ roleKey: 'ADMIN' }),
      ),
    ).rejects.toThrow('does not belong to this owner');
  });
});

describe('TasksService.update / createComment', () => {
  it('404s when the task is outside the caller owner scope', async () => {
    const prisma = makePrisma();
    const scoped = { task: { findFirst: jest.fn().mockResolvedValue(null) } };
    (prisma.forOwnerScope as jest.Mock).mockReturnValue(scoped);
    const service = new TasksService(prisma as never, makePermissions(['owner-1']) as never);

    await expect(
      service.update(makeUser({ roleKey: 'OWNER', ownerId: 'owner-1' }), 'task-other-owner', { status: 'COMPLETED' } as never),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.createComment(makeUser({ roleKey: 'OWNER', ownerId: 'owner-1' }), 'task-other-owner', { body: 'hi' } as never),
    ).rejects.toThrow(NotFoundException);
  });

  it('updates status once the task is confirmed within scope', async () => {
    const prisma = makePrisma();
    const scoped = { task: { findFirst: jest.fn().mockResolvedValue({ id: 'task-1' }) } };
    (prisma.forOwnerScope as jest.Mock).mockReturnValue(scoped);
    const service = new TasksService(prisma as never, makePermissions(['owner-1']) as never);

    await service.update(makeUser({ roleKey: 'OWNER', ownerId: 'owner-1' }), 'task-1', { status: 'COMPLETED' } as never);
    expect(prisma.client.task.update).toHaveBeenCalledWith({ where: { id: 'task-1' }, data: { status: 'COMPLETED' } });
  });
});

describe('TasksService.list (auto-generated lease renewal tasks)', () => {
  function makeScoped(lease: Record<string, unknown> | null, existingTask: Record<string, unknown> | null = null) {
    return {
      lease: { findMany: jest.fn().mockResolvedValue(lease ? [lease] : []) },
      task: {
        findFirst: jest.fn().mockResolvedValue(existingTask),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
  }

  function daysFromNow(days: number): Date {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
  }

  it('creates a renewal task for an ACTIVE, non-auto-renewing lease expiring within 60 days', async () => {
    const prisma = makePrisma();
    const lease = {
      id: 'lease-1',
      ownerId: 'owner-1',
      apartmentId: 'apt-1',
      tenantId: 'tenant-1',
      endDate: daysFromNow(30),
      apartment: { name: 'Ap 003' },
      tenant: { firstName: 'Nagy', lastName: 'Alexander' },
    };
    const scoped = makeScoped(lease);
    (prisma.forOwnerScope as jest.Mock).mockReturnValue(scoped);
    const service = new TasksService(prisma as never, makePermissions('all') as never);

    await service.list(makeUser({ roleKey: 'ADMIN' }), {} as never);

    expect(prisma.client.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ leaseId: 'lease-1', ownerId: 'owner-1', assignedToRole: 'ADMIN', urgent: false }),
      }),
    );
  });

  it('flags the task urgent when the lease has already expired', async () => {
    const prisma = makePrisma();
    const lease = {
      id: 'lease-1',
      ownerId: 'owner-1',
      apartmentId: 'apt-1',
      tenantId: 'tenant-1',
      endDate: daysFromNow(-5),
      apartment: { name: 'Ap 003' },
      tenant: { firstName: 'Nagy', lastName: 'Alexander' },
    };
    const scoped = makeScoped(lease);
    (prisma.forOwnerScope as jest.Mock).mockReturnValue(scoped);
    const service = new TasksService(prisma as never, makePermissions('all') as never);

    await service.list(makeUser({ roleKey: 'ADMIN' }), {} as never);

    expect(prisma.client.task.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ urgent: true }) }),
    );
  });

  it('does not create a second task once one already exists for that lease, no matter its status', async () => {
    const prisma = makePrisma();
    const lease = {
      id: 'lease-1',
      ownerId: 'owner-1',
      apartmentId: 'apt-1',
      tenantId: 'tenant-1',
      endDate: daysFromNow(10),
      apartment: { name: 'Ap 003' },
      tenant: { firstName: 'Nagy', lastName: 'Alexander' },
    };
    const scoped = makeScoped(lease, { id: 'task-existing', status: 'CANCELLED' });
    (prisma.forOwnerScope as jest.Mock).mockReturnValue(scoped);
    const service = new TasksService(prisma as never, makePermissions('all') as never);

    await service.list(makeUser({ roleKey: 'ADMIN' }), {} as never);

    expect(prisma.client.task.create).not.toHaveBeenCalled();
  });

  it('does not create a task for a lease that is still more than 60 days from expiry', async () => {
    const prisma = makePrisma();
    const lease = {
      id: 'lease-1',
      ownerId: 'owner-1',
      apartmentId: 'apt-1',
      tenantId: 'tenant-1',
      endDate: daysFromNow(120),
      apartment: { name: 'Ap 003' },
      tenant: { firstName: 'Nagy', lastName: 'Alexander' },
    };
    const scoped = makeScoped(lease);
    (prisma.forOwnerScope as jest.Mock).mockReturnValue(scoped);
    const service = new TasksService(prisma as never, makePermissions('all') as never);

    await service.list(makeUser({ roleKey: 'ADMIN' }), {} as never);

    expect(prisma.client.task.create).not.toHaveBeenCalled();
  });

  it('skips the sync entirely for a TENANT caller', async () => {
    const prisma = makePrisma();
    const scoped = makeScoped(null);
    (prisma.forOwnerScope as jest.Mock).mockReturnValue(scoped);
    const service = new TasksService(prisma as never, makePermissions([]) as never);

    await service.list(makeUser({ roleKey: 'TENANT', tenantId: 'tenant-1' }), {} as never);

    expect(scoped.lease.findMany).not.toHaveBeenCalled();
  });
});
