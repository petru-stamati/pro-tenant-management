import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../common/permissions.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { paginate, skipTake } from '../common/pagination';
import { ListInvoicesDto } from './dto/list-invoices.dto';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  async list(user: AuthenticatedUser, query: ListInvoicesDto) {
    const { page, pageSize, status, apartmentId } = query;
    const statusFilter = status ? { status: status as never } : {};
    const apartmentFilter = apartmentId ? { apartmentId } : {};

    if (user.roleKey === 'TENANT') {
      const where = { tenantId: user.tenantId ?? '__none__', ...statusFilter, ...apartmentFilter };
      const [data, total] = await Promise.all([
        this.prisma.client.invoice.findMany({
          where,
          include: { lease: { include: { apartment: true } } },
          orderBy: { invoiceDate: 'desc' },
          ...skipTake(page, pageSize),
        }),
        this.prisma.client.invoice.count({ where }),
      ]);
      return paginate(data, total, page, pageSize);
    }

    const allowedOwnerIds = await this.permissions.resolveAllowedOwnerIds(user);
    const scoped = this.prisma.forOwnerScope(allowedOwnerIds);
    const where = { ...statusFilter, ...apartmentFilter };
    const [data, total] = await Promise.all([
      scoped.invoice.findMany({
        where,
        include: { lease: { include: { apartment: true } } },
        orderBy: { invoiceDate: 'desc' },
        ...skipTake(page, pageSize),
      }),
      scoped.invoice.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async findOne(user: AuthenticatedUser, id: string) {
    if (user.roleKey === 'TENANT') {
      const invoice = await this.prisma.client.invoice.findFirst({
        where: { id, tenantId: user.tenantId ?? '__none__' },
        include: { lease: { include: { apartment: true } } },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');
      return invoice;
    }

    const allowedOwnerIds = await this.permissions.resolveAllowedOwnerIds(user);
    const invoice = await this.prisma.forOwnerScope(allowedOwnerIds).invoice.findFirst({
      where: { id },
      include: { lease: { include: { apartment: true } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async void(id: string) {
    const invoice = await this.prisma.client.invoice.findFirst({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.prisma.client.invoice.update({ where: { id }, data: { status: 'VOID' } });
  }
}
