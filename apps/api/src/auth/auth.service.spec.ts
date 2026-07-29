import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

jest.mock('argon2', () => ({
  verify: jest.fn(),
  hash: jest.fn().mockResolvedValue('hashed'),
  argon2id: 'argon2id',
}));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const argon2 = require('argon2');

function makeJwt() {
  return { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };
}

function makePrisma() {
  return {
    client: {
      user: { findFirst: jest.fn(), update: jest.fn() },
      auditLog: { count: jest.fn().mockResolvedValue(0), create: jest.fn() },
      refreshToken: { create: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
    },
  };
}

const activeUser = {
  id: 'user-1',
  email: 'pm@test.dev',
  passwordHash: 'stored-hash',
  status: 'ACTIVE',
  firstName: 'Ana',
  lastName: 'Pop',
  ownerId: null,
  tenantId: null,
  tokenVersion: 0,
  role: { key: 'ADMIN', name: 'Property Manager' },
};

describe('AuthService.login', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects an unknown email without writing an audit log (nothing to attribute the failure to)', async () => {
    const prisma = makePrisma();
    prisma.client.user.findFirst.mockResolvedValue(null);
    const service = new AuthService(prisma as never, makeJwt() as never);

    await expect(service.login('ghost@test.dev', 'whatever', {})).rejects.toThrow(UnauthorizedException);
    expect(prisma.client.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects a wrong password and records a LOGIN_FAILED audit entry', async () => {
    const prisma = makePrisma();
    prisma.client.user.findFirst.mockResolvedValue(activeUser);
    argon2.verify.mockResolvedValue(false);
    const service = new AuthService(prisma as never, makeJwt() as never);

    await expect(service.login('pm@test.dev', 'wrong', {})).rejects.toThrow(UnauthorizedException);
    expect(prisma.client.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'LOGIN_FAILED', entityId: 'user-1' }) }),
    );
  });

  it('locks the account out after 5 recent failures, even with the correct password', async () => {
    const prisma = makePrisma();
    prisma.client.user.findFirst.mockResolvedValue(activeUser);
    prisma.client.auditLog.count.mockResolvedValue(5);
    argon2.verify.mockResolvedValue(true);
    const service = new AuthService(prisma as never, makeJwt() as never);

    await expect(service.login('pm@test.dev', 'correct-password', {})).rejects.toThrow(ForbiddenException);
    expect(argon2.verify).not.toHaveBeenCalled();
  });

  it('rejects a correct password for a non-ACTIVE (suspended) account', async () => {
    const prisma = makePrisma();
    prisma.client.user.findFirst.mockResolvedValue({ ...activeUser, status: 'SUSPENDED' });
    argon2.verify.mockResolvedValue(true);
    const service = new AuthService(prisma as never, makeJwt() as never);

    await expect(service.login('pm@test.dev', 'correct-password', {})).rejects.toThrow(UnauthorizedException);
  });

  it('issues a token pair and updates lastLoginAt on success', async () => {
    const prisma = makePrisma();
    prisma.client.user.findFirst.mockResolvedValue(activeUser);
    argon2.verify.mockResolvedValue(true);
    const jwt = makeJwt();
    const service = new AuthService(prisma as never, jwt as never);

    const result = await service.login('pm@test.dev', 'correct-password', { ipAddress: '127.0.0.1' });

    expect(result.accessToken).toBe('signed.jwt.token');
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(prisma.client.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } }),
    );
    expect(prisma.client.refreshToken.create).toHaveBeenCalled();
    expect(prisma.client.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'LOGIN' }) }),
    );
  });

  it('never leaks the passwordHash in the returned user payload', async () => {
    const prisma = makePrisma();
    prisma.client.user.findFirst.mockResolvedValue(activeUser);
    argon2.verify.mockResolvedValue(true);
    const service = new AuthService(prisma as never, makeJwt() as never);

    const result = await service.login('pm@test.dev', 'correct-password', {});
    expect(JSON.stringify(result.user)).not.toContain('stored-hash');
    expect((result.user as Record<string, unknown>).passwordHash).toBeUndefined();
  });
});

describe('AuthService.refresh (rotation + reuse detection)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects an unknown refresh token', async () => {
    const prisma = makePrisma();
    prisma.client.refreshToken.findFirst.mockResolvedValue(null);
    const service = new AuthService(prisma as never, makeJwt() as never);

    await expect(service.refresh('bogus-token', {})).rejects.toThrow(UnauthorizedException);
  });

  it('treats reuse of an already-rotated token as theft: revokes every session for that user', async () => {
    const prisma = makePrisma();
    prisma.client.refreshToken.findFirst.mockResolvedValue({
      id: 'rt-1',
      userId: 'user-1',
      revokedAt: new Date('2020-01-01'),
      expiresAt: new Date('2099-01-01'),
      user: activeUser,
    });
    const service = new AuthService(prisma as never, makeJwt() as never);

    await expect(service.refresh('stolen-token', {})).rejects.toThrow(
      'Refresh token reuse detected — all sessions revoked',
    );
    expect(prisma.client.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rejects an expired but not-yet-revoked token', async () => {
    const prisma = makePrisma();
    prisma.client.refreshToken.findFirst.mockResolvedValue({
      id: 'rt-1',
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date('2020-01-01'),
      user: activeUser,
    });
    const service = new AuthService(prisma as never, makeJwt() as never);

    await expect(service.refresh('expired-token', {})).rejects.toThrow('Refresh token expired');
  });

  it('rotates a valid token: issues a new pair and revokes the old row', async () => {
    const prisma = makePrisma();
    prisma.client.refreshToken.findFirst
      .mockResolvedValueOnce({
        id: 'rt-1',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date('2099-01-01'),
        user: activeUser,
      })
      .mockResolvedValueOnce({ id: 'rt-2' }); // the newly-created row, looked up by its hash
    const service = new AuthService(prisma as never, makeJwt() as never);

    const result = await service.refresh('valid-token', {});

    expect(result.accessToken).toBe('signed.jwt.token');
    expect(prisma.client.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'rt-1' },
      data: { revokedAt: expect.any(Date), replacedByTokenId: 'rt-2' },
    });
  });
});
