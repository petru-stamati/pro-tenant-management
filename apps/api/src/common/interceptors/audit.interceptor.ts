import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditAction } from '@pro-tenant/db';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../types/authenticated-user';

const METHOD_TO_ACTION: Record<string, AuditAction> = {
  POST: 'CREATE',
  PATCH: 'UPDATE',
  PUT: 'UPDATE',
  DELETE: 'SOFT_DELETE',
};

/**
 * Writes one AuditLog row per mutating request (PRD §5: "audit log of every
 * write"). Captures the response body as `after` — capturing a true
 * pre-mutation `before` snapshot generically, without each service handing
 * it a diff, is left for services where that matters most (payments,
 * maintenance decisions); this interceptor guarantees the *fact* of every
 * write is logged even where a per-field diff isn't wired up yet.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const action = METHOD_TO_ACTION[request.method];

    if (!action || !request.user) {
      return next.handle();
    }

    const entityType = context.getClass().name.replace(/Controller$/, '');

    return next.handle().pipe(
      tap((result) => {
        const fromResult =
          result && typeof result === 'object' && 'id' in result
            ? (result as { id: string }).id
            : undefined;
        const fromParam = request.params?.id;
        const entityId = fromResult ?? (Array.isArray(fromParam) ? fromParam[0] : fromParam) ?? 'unknown';

        void this.prisma.client.auditLog.create({
          data: {
            actorId: request.user!.id,
            action,
            entityType,
            entityId,
            after: result as object,
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          },
        });
      }),
    );
  }
}
