import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'requiredPermission';

/** The permission-key catalog from Phase 4 §6 — checked by PermissionGuard (layer 1: "can you call this action at all"). */
export const RequirePermission = (key: string) => SetMetadata(PERMISSION_KEY, key);
