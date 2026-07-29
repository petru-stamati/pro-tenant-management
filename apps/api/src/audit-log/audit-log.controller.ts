import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { paginate, skipTake } from '../common/pagination';
import { ListAuditLogDto } from './dto/list-audit-log.dto';

@Controller('audit-log')
export class AuditLogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('audit:read')
  async list(@Query() query: ListAuditLogDto) {
    const { page, pageSize, entityType, entityId, actorId } = query;
    const where = {
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...(actorId ? { actorId } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.client.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        ...skipTake(page, pageSize),
      }),
      this.prisma.client.auditLog.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }
}
