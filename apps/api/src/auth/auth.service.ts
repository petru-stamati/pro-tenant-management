import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, Phase 4 §1
const LOGIN_LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCKOUT_THRESHOLD = 5;

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string, meta: RequestMeta): Promise<TokenPair & { user: unknown }> {
    const user = await this.prisma.client.user.findFirst({
      where: { email },
      include: { role: true },
    });

    if (user) {
      const recentFailures = await this.prisma.client.auditLog.count({
        where: {
          entityType: 'User',
          entityId: user.id,
          action: 'LOGIN_FAILED',
          createdAt: { gte: new Date(Date.now() - LOGIN_LOCKOUT_WINDOW_MS) },
        },
      });
      if (recentFailures >= LOGIN_LOCKOUT_THRESHOLD) {
        throw new ForbiddenException('Too many failed attempts. Try again in 15 minutes.');
      }
    }

    const valid = user && user.status === 'ACTIVE' && (await argon2.verify(user.passwordHash, password));
    if (!user || !valid) {
      if (user) {
        await this.prisma.client.auditLog.create({
          data: {
            entityType: 'User',
            entityId: user.id,
            action: 'LOGIN_FAILED',
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
          },
        });
      }
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.prisma.client.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await this.prisma.client.auditLog.create({
      data: {
        actorId: user.id,
        entityType: 'User',
        entityId: user.id,
        action: 'LOGIN',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    const tokens = await this.issueTokenPair(user, meta);
    return { ...tokens, user: toPublicUser(user) };
  }

  async refresh(rawToken: string, meta: RequestMeta): Promise<TokenPair> {
    const tokenHash = hashToken(rawToken);
    const existing = await this.prisma.client.refreshToken.findFirst({
      where: { tokenHash },
      include: { user: { include: { role: true } } },
    });

    if (!existing) throw new UnauthorizedException('Invalid refresh token');

    if (existing.revokedAt) {
      // Reuse of an already-rotated token — treat as theft and kill every
      // session for this user (Phase 4 §1/§2).
      await this.prisma.client.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token reuse detected — all sessions revoked');
    }

    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const tokens = await this.issueTokenPair(existing.user, meta);
    const newTokenHash = hashToken(tokens.refreshToken);
    const newRow = await this.prisma.client.refreshToken.findFirst({ where: { tokenHash: newTokenHash } });

    await this.prisma.client.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedByTokenId: newRow?.id },
    });

    return tokens;
  }

  async logout(rawToken: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    await this.prisma.client.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Public "is this you?" preview shown before the tenant sets a password (Phase 4 §3 step 3). */
  async previewInvite(rawToken: string) {
    const invite = await this.findPendingInvite(rawToken);
    return {
      tenantName: `${invite.tenant.firstName} ${invite.tenant.lastName}`,
      apartmentName: invite.lease.apartment.name,
      addressLine: invite.lease.apartment.addressLine,
      alreadyHasAccount: invite.tenant.user !== null,
    };
  }

  async acceptInvite(rawToken: string, password: string | undefined, meta: RequestMeta) {
    const invite = await this.findPendingInvite(rawToken);
    const tenantRole = await this.prisma.client.role.findFirstOrThrow({ where: { key: 'TENANT' } });

    let user;
    if (invite.tenant.user) {
      // Repeat tenant, second lease with a different owner (PRD §3.2) — link
      // to the existing account rather than creating a duplicate; they keep
      // their existing password.
      user = await this.prisma.client.user.findFirstOrThrow({
        where: { id: invite.tenant.user.id },
        include: { role: true },
      });
    } else {
      if (!password) throw new BadRequestException('Password is required for a first-time account');
      const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
      user = await this.prisma.client.user.create({
        data: {
          email: invite.email,
          passwordHash,
          firstName: invite.tenant.firstName,
          lastName: invite.tenant.lastName,
          roleId: tenantRole.id,
          tenantId: invite.tenantId,
          status: 'ACTIVE',
        },
        include: { role: true },
      });
    }

    await this.prisma.client.tenantInvite.update({
      where: { id: invite.id },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });
    await this.prisma.client.auditLog.create({
      data: {
        actorId: user.id,
        entityType: 'TenantInvite',
        entityId: invite.id,
        action: 'INVITE_ACCEPTED',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    const tokens = await this.issueTokenPair(user, meta);
    return { ...tokens, user: toPublicUser(user) };
  }

  private async findPendingInvite(rawToken: string) {
    const tokenHash = hashToken(rawToken);
    const invite = await this.prisma.client.tenantInvite.findFirst({
      where: { token: tokenHash, status: 'PENDING' },
      include: { tenant: { include: { user: true } }, lease: { include: { apartment: true } } },
    });
    if (!invite) throw new NotFoundException('Invite not found or already used');
    if (invite.expiresAt < new Date()) throw new BadRequestException('This invite has expired');
    return invite;
  }

  async me(userId: string) {
    const user = await this.prisma.client.user.findFirst({
      where: { id: userId },
      include: { role: true },
    });
    if (!user) throw new UnauthorizedException();
    return toPublicUser(user);
  }

  private async issueTokenPair(
    user: { id: string; role: { key: string | null }; ownerId: string | null; tenantId: string | null; tokenVersion: number },
    meta: RequestMeta,
  ): Promise<TokenPair> {
    const payload: AuthenticatedUser = {
      id: user.id,
      roleKey: user.role.key as AuthenticatedUser['roleKey'],
      ownerId: user.ownerId,
      tenantId: user.tenantId,
      tokenVersion: user.tokenVersion,
    };
    const accessToken = await this.jwt.signAsync(payload);

    const refreshToken = randomBytes(32).toString('hex');
    await this.prisma.client.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    return { accessToken, refreshToken };
  }
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function toPublicUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: { key: string | null; name: string };
  ownerId: string | null;
  tenantId: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role.key,
    ownerId: user.ownerId,
    tenantId: user.tenantId,
  };
}
