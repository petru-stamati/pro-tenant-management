import { SystemRoleKey } from '@pro-tenant/db';

/** The shape of the JWT access token payload, and what JwtAuthGuard attaches to `req.user`. */
export interface AuthenticatedUser {
  id: string;
  roleKey: SystemRoleKey | null;
  ownerId: string | null;
  tenantId: string | null;
  tokenVersion: number;
}
