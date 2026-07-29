import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

function makeContext(headers: Record<string, string> = {}, handlerMeta: unknown = undefined) {
  const request: Record<string, unknown> = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handlerMeta,
    getClass: () => undefined,
    __request: request,
  } as never;
}

describe('JwtAuthGuard', () => {
  it('allows a request through untouched when the route is marked @Public', async () => {
    const jwtService = { verifyAsync: jest.fn() };
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) };
    const prisma = { client: { user: { findFirst: jest.fn() } } };
    const guard = new JwtAuthGuard(jwtService as never, reflector as never, prisma as never);

    await expect(guard.canActivate(makeContext())).resolves.toBe(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects a request with no Authorization header', async () => {
    const jwtService = { verifyAsync: jest.fn() };
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    const prisma = { client: { user: { findFirst: jest.fn() } } };
    const guard = new JwtAuthGuard(jwtService as never, reflector as never, prisma as never);

    await expect(guard.canActivate(makeContext())).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a header that is not a Bearer token', async () => {
    const jwtService = { verifyAsync: jest.fn() };
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    const prisma = { client: { user: { findFirst: jest.fn() } } };
    const guard = new JwtAuthGuard(jwtService as never, reflector as never, prisma as never);

    await expect(guard.canActivate(makeContext({ authorization: 'Basic abc123' }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token that fails signature/expiry verification', async () => {
    const jwtService = { verifyAsync: jest.fn().mockRejectedValue(new Error('jwt expired')) };
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    const prisma = { client: { user: { findFirst: jest.fn() } } };
    const guard = new JwtAuthGuard(jwtService as never, reflector as never, prisma as never);

    await expect(guard.canActivate(makeContext({ authorization: 'Bearer bad.token' }))).rejects.toThrow(
      'Invalid or expired access token',
    );
  });

  it('rejects a structurally-valid token whose tokenVersion no longer matches the DB (revoked session)', async () => {
    const jwtService = { verifyAsync: jest.fn().mockResolvedValue({ id: 'user-1', tokenVersion: 0 }) };
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    const prisma = { client: { user: { findFirst: jest.fn().mockResolvedValue({ tokenVersion: 1 }) } } };
    const guard = new JwtAuthGuard(jwtService as never, reflector as never, prisma as never);

    await expect(guard.canActivate(makeContext({ authorization: 'Bearer old.token' }))).rejects.toThrow(
      'Session has been revoked',
    );
  });

  it('rejects a token for a user that no longer exists', async () => {
    const jwtService = { verifyAsync: jest.fn().mockResolvedValue({ id: 'ghost', tokenVersion: 0 }) };
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    const prisma = { client: { user: { findFirst: jest.fn().mockResolvedValue(null) } } };
    const guard = new JwtAuthGuard(jwtService as never, reflector as never, prisma as never);

    await expect(guard.canActivate(makeContext({ authorization: 'Bearer token' }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('accepts a valid, unrevoked token and attaches the payload to the request as req.user', async () => {
    const payload = { id: 'user-1', roleKey: 'ADMIN', ownerId: null, tenantId: null, tokenVersion: 2 };
    const jwtService = { verifyAsync: jest.fn().mockResolvedValue(payload) };
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    const prisma = { client: { user: { findFirst: jest.fn().mockResolvedValue({ tokenVersion: 2 }) } } };
    const guard = new JwtAuthGuard(jwtService as never, reflector as never, prisma as never);

    const context = makeContext({ authorization: 'Bearer good.token' });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect((context as unknown as { __request: { user: unknown } }).__request.user).toEqual(payload);
  });
});
