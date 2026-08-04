import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InspectionsService } from './inspections.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { id: 'pm-1', roleKey: 'ADMIN', ownerId: null, tenantId: null, tokenVersion: 0, ...overrides };
}

function makePrisma() {
  const itemStore: Record<string, Record<string, unknown>> = {
    'item-1': { id: 'item-1', name: 'Dishwasher', condition: 'GOOD', conditionNote: null, deletedAt: null },
  };
  const inspectionStore: Record<string, Record<string, unknown>> = {
    'insp-1': { id: 'insp-1', apartmentId: 'apt-1', ownerId: 'owner-1', status: 'IN_PROGRESS' },
    'insp-done': { id: 'insp-done', apartmentId: 'apt-1', ownerId: 'owner-1', status: 'COMPLETED' },
  };
  const tx = {
    inspectionResult: {
      create: jest.fn(async (args) => ({ id: 'result-1', ...args.data })),
    },
    roomItem: {
      update: jest.fn(async (args) => {
        itemStore[args.where.id] = { ...itemStore[args.where.id], ...args.data };
        return itemStore[args.where.id];
      }),
    },
  };
  return {
    client: {
      apartment: { findFirst: jest.fn().mockResolvedValue({ id: 'apt-1', ownerId: 'owner-1', name: 'Apt 1' }) },
      roomItem: {
        findFirst: jest.fn(async (args: { where: { id: string } }) => itemStore[args.where.id] ?? null),
      },
      inspection: {
        findFirst: jest.fn(async (args: { where: { id?: string; apartmentId?: string; status?: string } }) => {
          if (args.where.id) return inspectionStore[args.where.id] ?? null;
          const match = Object.values(inspectionStore).find(
            (i) => i.apartmentId === args.where.apartmentId && i.status === args.where.status,
          );
          return match ?? null;
        }),
        create: jest.fn(async (args) => ({ id: 'insp-new', status: 'IN_PROGRESS', results: [], ...args.data })),
        update: jest.fn(async (args) => ({ ...inspectionStore[args.where.id], ...args.data })),
      },
      inspectionResult: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
    },
    forOwnerScope: jest.fn(),
    tx,
    itemStore,
    inspectionStore,
  };
}

function makePermissions() {
  return { resolveAllowedOwnerIds: jest.fn().mockResolvedValue('all') };
}

function makeNotifications() {
  return { notifyRole: jest.fn().mockResolvedValue(undefined) };
}

describe('InspectionsService.recordResult', () => {
  it('rejects recording a result when the inspection is already completed', async () => {
    const prisma = makePrisma();
    const service = new InspectionsService(prisma as never, makePermissions() as never, makeNotifications() as never);

    await expect(
      service.recordResult('insp-done', { roomItemId: 'item-1', outcome: 'CONFIRMED_GOOD' } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException for an inspection that does not exist', async () => {
    const prisma = makePrisma();
    const service = new InspectionsService(prisma as never, makePermissions() as never, makeNotifications() as never);

    await expect(
      service.recordResult('ghost', { roomItemId: 'item-1', outcome: 'CONFIRMED_GOOD' } as never),
    ).rejects.toThrow(NotFoundException);
  });

  it('CONFIRMED_GOOD resets the item to GOOD with no note', async () => {
    const prisma = makePrisma();
    prisma.itemStore['item-1'] = { id: 'item-1', name: 'Dishwasher', condition: 'NEEDS_ATTENTION', conditionNote: 'leaking' };
    const service = new InspectionsService(prisma as never, makePermissions() as never, makeNotifications() as never);

    await service.recordResult('insp-1', { roomItemId: 'item-1', outcome: 'CONFIRMED_GOOD' } as never);

    expect(prisma.tx.roomItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { condition: 'GOOD', conditionNote: null },
    });
  });

  it('rejects NEEDS_ATTENTION without a note', async () => {
    const prisma = makePrisma();
    const service = new InspectionsService(prisma as never, makePermissions() as never, makeNotifications() as never);

    await expect(
      service.recordResult('insp-1', { roomItemId: 'item-1', outcome: 'NEEDS_ATTENTION' } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('NEEDS_ATTENTION with a note flags the item without deleting or renaming it', async () => {
    const prisma = makePrisma();
    const service = new InspectionsService(prisma as never, makePermissions() as never, makeNotifications() as never);

    await service.recordResult(
      'insp-1',
      { roomItemId: 'item-1', outcome: 'NEEDS_ATTENTION', note: 'walls need paint' } as never,
    );

    expect(prisma.tx.roomItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { condition: 'NEEDS_ATTENTION', conditionNote: 'walls need paint' },
    });
  });

  it('rejects REPLACED without a new item description', async () => {
    const prisma = makePrisma();
    const service = new InspectionsService(prisma as never, makePermissions() as never, makeNotifications() as never);

    await expect(
      service.recordResult('insp-1', { roomItemId: 'item-1', outcome: 'REPLACED' } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('REPLACED overwrites the item name and resets condition to GOOD', async () => {
    const prisma = makePrisma();
    const service = new InspectionsService(prisma as never, makePermissions() as never, makeNotifications() as never);

    const result = await service.recordResult(
      'insp-1',
      { roomItemId: 'item-1', outcome: 'REPLACED', newName: '1 new dishwasher', note: 'old one broke' } as never,
    );

    expect(prisma.tx.roomItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { name: '1 new dishwasher', condition: 'GOOD', conditionNote: null },
    });
    expect((result as { previousItemName: string }).previousItemName).toBe('Dishwasher');
  });

  it('rejects REMOVED without a reason', async () => {
    const prisma = makePrisma();
    const service = new InspectionsService(prisma as never, makePermissions() as never, makeNotifications() as never);

    await expect(
      service.recordResult('insp-1', { roomItemId: 'item-1', outcome: 'REMOVED' } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('REMOVED soft-deletes the item', async () => {
    const prisma = makePrisma();
    const service = new InspectionsService(prisma as never, makePermissions() as never, makeNotifications() as never);

    await service.recordResult(
      'insp-1',
      { roomItemId: 'item-1', outcome: 'REMOVED', note: 'no longer in the apartment' } as never,
    );

    expect(prisma.tx.roomItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { deletedAt: expect.any(Date) },
    });
  });
});

describe('InspectionsService.startOrResume', () => {
  it('resumes an already-open inspection instead of creating a second one', async () => {
    const prisma = makePrisma();
    const service = new InspectionsService(prisma as never, makePermissions() as never, makeNotifications() as never);

    const result = await service.startOrResume({ apartmentId: 'apt-1' } as never, makeUser({}));

    expect((result as { id: string }).id).toBe('insp-1');
    expect(prisma.client.inspection.create).not.toHaveBeenCalled();
  });

  it('starts a new inspection when none is in progress', async () => {
    const prisma = makePrisma();
    prisma.inspectionStore['insp-1'].status = 'COMPLETED';
    const service = new InspectionsService(prisma as never, makePermissions() as never, makeNotifications() as never);

    await service.startOrResume({ apartmentId: 'apt-1' } as never, makeUser({}));

    expect(prisma.client.inspection.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ apartmentId: 'apt-1', ownerId: 'owner-1' }) }),
    );
  });
});

describe('InspectionsService.complete', () => {
  it('rejects completing an inspection that is already completed', async () => {
    const prisma = makePrisma();
    const service = new InspectionsService(prisma as never, makePermissions() as never, makeNotifications() as never);

    await expect(service.complete('insp-done', {} as never)).rejects.toThrow(BadRequestException);
  });

  it('notifies the owner with a summary built from the recorded results', async () => {
    const prisma = makePrisma();
    prisma.client.inspectionResult.findMany = jest.fn().mockResolvedValue([
      { previousItemName: 'Dishwasher', outcome: 'CONFIRMED_GOOD', note: null },
      { previousItemName: 'Walls', outcome: 'NEEDS_ATTENTION', note: 'need paint' },
    ]);
    const notifications = makeNotifications();
    const service = new InspectionsService(prisma as never, makePermissions() as never, notifications as never);

    await service.complete('insp-1', {} as never);

    expect(notifications.notifyRole).toHaveBeenCalledWith(
      'owner-1',
      'OWNER',
      'INSPECTION_COMPLETED',
      expect.stringContaining('Apt 1'),
      'Dishwasher — good. Walls — need paint',
      'Inspection',
      'insp-1',
    );
  });
});
