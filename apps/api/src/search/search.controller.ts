import { Controller, Get, Query } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

class SearchQueryDto {
  @IsString()
  @MinLength(2)
  q!: string;
}

/**
 * Postgres ILIKE across the core entities for now — the schema file already
 * documents the upgrade path to a generated tsvector + GIN index once
 * migrations need it (packages/db/prisma/schema.prisma, Document model).
 */
@Controller('search')
export class SearchController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('search:read')
  async search(@Query() query: SearchQueryDto) {
    const [apartments, owners, tenants, documents] = await Promise.all([
      this.prisma.client.apartment.findMany({
        where: { OR: [{ name: { contains: query.q, mode: 'insensitive' } }, { addressLine: { contains: query.q, mode: 'insensitive' } }] },
        take: 10,
      }),
      this.prisma.client.owner.findMany({
        where: { OR: [{ companyName: { contains: query.q, mode: 'insensitive' } }, { contactName: { contains: query.q, mode: 'insensitive' } }, { email: { contains: query.q, mode: 'insensitive' } }] },
        take: 10,
      }),
      this.prisma.client.tenant.findMany({
        where: { OR: [{ firstName: { contains: query.q, mode: 'insensitive' } }, { lastName: { contains: query.q, mode: 'insensitive' } }, { email: { contains: query.q, mode: 'insensitive' } }] },
        take: 10,
      }),
      this.prisma.client.document.findMany({
        where: { fileName: { contains: query.q, mode: 'insensitive' } },
        take: 10,
      }),
    ]);
    return { apartments, owners, tenants, documents };
  }
}
