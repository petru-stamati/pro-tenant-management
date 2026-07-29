import { ForbiddenException } from '@nestjs/common';
import { PermissionGuard } from './permission.guard';

function makeContext(user: unknown, requiredPermission: string | undefined) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
    __requiredPermission: requiredPermission,
  } as never;
}

describe('PermissionGuard', () => {
  it('allows a route with no @RequirePermission decorator through unconditionally', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };
    const permissions = { getEffectivePermissions: jest.fn() };
    const guard = new PermissionGuard(reflector as never, permissions as never);

    await expect(guard.canActivate(makeContext({ id: 'user-1' }, undefined))).resolves.toBe(true);
    expect(permissions.getEffectivePermissions).not.toHaveBeenCalled();
  });

  it('denies an unauthenticated request (no req.user) on a permission-gated route', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue('apartments.write') };
    const permissions = { getEffectivePermissions: jest.fn() };
    const guard = new PermissionGuard(reflector as never, permissions as never);

    await expect(guard.canActivate(makeContext(undefined, 'apartments.write'))).resolves.toBe(false);
  });

  it('throws ForbiddenException when the caller lacks the required permission', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue('apartments.write') };
    const permissions = { getEffectivePermissions: jest.fn().mockResolvedValue(new Set(['apartments.read'])) };
    const guard = new PermissionGuard(reflector as never, permissions as never);

    await expect(guard.canActivate(makeContext({ id: 'user-1' }, 'apartments.write'))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows the call through when the caller has the exact required permission', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue('apartments.write') };
    const permissions = { getEffectivePermissions: jest.fn().mockResolvedValue(new Set(['apartments.write'])) };
    const guard = new PermissionGuard(reflector as never, permissions as never);

    await expect(guard.canActivate(makeContext({ id: 'user-1' }, 'apartments.write'))).resolves.toBe(true);
  });

  it('does not grant access based on an unrelated permission the caller happens to hold', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue('documents.delete') };
    const permissions = {
      getEffectivePermissions: jest.fn().mockResolvedValue(new Set(['apartments.write', 'leases.write'])),
    };
    const guard = new PermissionGuard(reflector as never, permissions as never);

    await expect(guard.canActivate(makeContext({ id: 'user-1' }, 'documents.delete'))).rejects.toThrow(
      ForbiddenException,
    );
  });
});
