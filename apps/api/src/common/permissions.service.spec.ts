import { PermissionsService } from './permissions.service';
import { AuthenticatedUser } from './types/authenticated-user';

function makeUser(overrides: Partial<AuthenticatedUser>): AuthenticatedUser {
  return { id: 'user-1', roleKey: 'OWNER', ownerId: null, tenantId: null, tokenVersion: 0, ...overrides };
}

describe('PermissionsService.resolveAllowedOwnerIds', () => {
  it('gives ADMIN unrestricted access', async () => {
    const prisma = { client: { userPermission: { findMany: jest.fn() } } };
    const service = new PermissionsService(prisma as never);
    const result = await service.resolveAllowedOwnerIds(makeUser({ roleKey: 'ADMIN' }));
    expect(result).toBe('all');
    expect(prisma.client.userPermission.findMany).not.toHaveBeenCalled();
  });

  it('restricts OWNER to exactly their own ownerId', async () => {
    const prisma = { client: { userPermission: { findMany: jest.fn() } } };
    const service = new PermissionsService(prisma as never);
    const result = await service.resolveAllowedOwnerIds(makeUser({ roleKey: 'OWNER', ownerId: 'owner-1' }));
    expect(result).toEqual(['owner-1']);
  });

  it('gives an OWNER user with no ownerId zero access rather than "all"', async () => {
    const prisma = { client: { userPermission: { findMany: jest.fn() } } };
    const service = new PermissionsService(prisma as never);
    const result = await service.resolveAllowedOwnerIds(makeUser({ roleKey: 'OWNER', ownerId: null }));
    expect(result).toEqual([]);
  });

  it('gives TENANT zero owner-scoped access (tenant scoping runs on tenantId elsewhere)', async () => {
    const prisma = { client: { userPermission: { findMany: jest.fn() } } };
    const service = new PermissionsService(prisma as never);
    const result = await service.resolveAllowedOwnerIds(makeUser({ roleKey: 'TENANT', tenantId: 'tenant-1' }));
    expect(result).toEqual([]);
  });

  it('resolves a non-system-role user (future Employee) to the union of their per-owner UserPermission grants', async () => {
    const findMany = jest.fn().mockResolvedValue([{ ownerId: 'owner-1' }, { ownerId: 'owner-2' }, { ownerId: 'owner-1' }]);
    const prisma = { client: { userPermission: { findMany } } };
    const service = new PermissionsService(prisma as never);
    const result = await service.resolveAllowedOwnerIds(makeUser({ roleKey: null }));
    expect(result).toEqual(expect.arrayContaining(['owner-1', 'owner-2']));
    expect((result as string[]).length).toBe(2);
  });

  it('treats a null-scoped UserPermission grant as unrestricted access, even mixed with scoped grants', async () => {
    const findMany = jest.fn().mockResolvedValue([{ ownerId: 'owner-1' }, { ownerId: null }]);
    const prisma = { client: { userPermission: { findMany } } };
    const service = new PermissionsService(prisma as never);
    const result = await service.resolveAllowedOwnerIds(makeUser({ roleKey: null }));
    expect(result).toBe('all');
  });

  it('gives a non-system-role user with no grants at all zero access', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { client: { userPermission: { findMany } } };
    const service = new PermissionsService(prisma as never);
    const result = await service.resolveAllowedOwnerIds(makeUser({ roleKey: null }));
    expect(result).toEqual([]);
  });
});

describe('PermissionsService.getEffectivePermissions', () => {
  it('unions role permissions and individual user-permission grants', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      role: { rolePermissions: [{ permission: { key: 'apartments.read' } }, { permission: { key: 'apartments.write' } }] },
      userPermissions: [{ permission: { key: 'documents.delete' } }],
    });
    const prisma = { client: { user: { findFirst } } };
    const service = new PermissionsService(prisma as never);
    const result = await service.getEffectivePermissions('user-1');
    expect(result).toEqual(new Set(['apartments.read', 'apartments.write', 'documents.delete']));
  });

  it('serves from cache on a second call without re-querying', async () => {
    const findFirst = jest.fn().mockResolvedValue({ role: { rolePermissions: [] }, userPermissions: [] });
    const prisma = { client: { user: { findFirst } } };
    const service = new PermissionsService(prisma as never);
    await service.getEffectivePermissions('user-1');
    await service.getEffectivePermissions('user-1');
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it('re-queries after invalidate()', async () => {
    const findFirst = jest.fn().mockResolvedValue({ role: { rolePermissions: [] }, userPermissions: [] });
    const prisma = { client: { user: { findFirst } } };
    const service = new PermissionsService(prisma as never);
    await service.getEffectivePermissions('user-1');
    service.invalidate('user-1');
    await service.getEffectivePermissions('user-1');
    expect(findFirst).toHaveBeenCalledTimes(2);
  });

  it('returns an empty set when the user cannot be found', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = { client: { user: { findFirst } } };
    const service = new PermissionsService(prisma as never);
    const result = await service.getEffectivePermissions('ghost');
    expect(result).toEqual(new Set());
  });
});
