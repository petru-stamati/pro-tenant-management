import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from './types/authenticated-user';

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  expiresAt: number;
  permissions: Set<string>;
}

/**
 * Resolves a user's effective permission set (Role bundle ∪ individual
 * UserPermission grants) — Phase 4 §5 layer 1. Cached in-process for 60s;
 * this is a placeholder for the Redis-backed cache the architecture doc
 * calls for once Redis is provisioned on this machine (see
 * packages/db/README.md) — behaviorally identical, just not shared across
 * multiple API instances yet.
 */
@Injectable()
export class PermissionsService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  async getEffectivePermissions(userId: string): Promise<Set<string>> {
    const cached = this.cache.get(userId);
    if (cached && cached.expiresAt > Date.now()) return cached.permissions;

    const user = await this.prisma.client.user.findFirst({
      where: { id: userId },
      select: {
        role: { select: { rolePermissions: { select: { permission: { select: { key: true } } } } } },
        userPermissions: { select: { permission: { select: { key: true } } } },
      },
    });

    const permissions = new Set<string>([
      ...(user?.role.rolePermissions.map((rp) => rp.permission.key) ?? []),
      ...(user?.userPermissions.map((up) => up.permission.key) ?? []),
    ]);

    this.cache.set(userId, { expiresAt: Date.now() + CACHE_TTL_MS, permissions });
    return permissions;
  }

  /** Called whenever a Role/Permission/UserPermission grant changes for this user. */
  invalidate(userId: string) {
    this.cache.delete(userId);
  }

  /**
   * Resolves the ownerId set a caller's queries/writes should be restricted
   * to (Phase 4 §8). ADMIN is unrestricted; OWNER is exactly their own
   * company; a future EMPLOYEE role falls back to whatever UserPermission
   * grants specify (null-scoped grant = unrestricted for that permission).
   */
  async resolveAllowedOwnerIds(user: AuthenticatedUser): Promise<string[] | 'all'> {
    if (user.roleKey === 'ADMIN') return 'all';
    if (user.roleKey === 'OWNER') return user.ownerId ? [user.ownerId] : [];
    if (user.roleKey === 'TENANT') return []; // Tenant scoping runs on tenantId, not ownerId — see service layer.

    const grants = await this.prisma.client.userPermission.findMany({
      where: { userId: user.id },
      select: { ownerId: true },
    });
    if (grants.some((g) => g.ownerId === null)) return 'all';
    return [...new Set(grants.map((g) => g.ownerId).filter((id): id is string => id !== null))];
  }
}
