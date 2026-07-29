import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { PermissionsService } from '../permissions.service';
import { AuthenticatedUser } from '../types/authenticated-user';

/** Phase 4 §5 layer 1 — "can you call this action at all." Layer 2 (row scoping) lives in the Prisma service layer. */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<string | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermission) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) return false; // JwtAuthGuard runs first; no user means unauthenticated.

    const effective = await this.permissions.getEffectivePermissions(user.id);
    if (!effective.has(requiredPermission)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `You do not have permission to perform this action.`,
        requiredPermission,
      });
    }
    return true;
  }
}
