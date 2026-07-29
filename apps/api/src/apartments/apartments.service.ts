import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../common/permissions.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { paginate, skipTake } from '../common/pagination';
import { CreateApartmentDto } from './dto/create-apartment.dto';
import { UpdateApartmentDto } from './dto/update-apartment.dto';
import { ListApartmentsDto } from './dto/list-apartments.dto';

@Injectable()
export class ApartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  async list(user: AuthenticatedUser, query: ListApartmentsDto) {
    const { page, pageSize, search, ownerId, status } = query;

    // Tenant access runs on the lease relationship (tenantId), not the
    // denormalized ownerId column — a different scoping key entirely
    // (Phase 4 §8), so it gets its own query path rather than forcing it
    // through the owner-scoped client.
    if (user.roleKey === 'TENANT') {
      const where = {
        leases: { some: { tenantId: user.tenantId ?? '__none__' } },
        ...(status ? { status } : {}),
      };
      const [data, total] = await Promise.all([
        this.prisma.client.apartment.findMany({ where, ...skipTake(page, pageSize) }),
        this.prisma.client.apartment.count({ where }),
      ]);
      return paginate(data, total, page, pageSize);
    }

    const allowedOwnerIds = await this.permissions.resolveAllowedOwnerIds(user);
    const scoped = this.prisma.forOwnerScope(allowedOwnerIds);
    const where = {
      ...(ownerId ? { ownerId } : {}),
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { addressLine: { contains: search, mode: 'insensitive' as const } },
              { city: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      scoped.apartment.findMany({
        where,
        include: { currentLease: true },
        orderBy: { createdAt: 'desc' },
        ...skipTake(page, pageSize),
      }),
      scoped.apartment.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async findOne(user: AuthenticatedUser, id: string) {
    if (user.roleKey === 'TENANT') {
      const apartment = await this.prisma.client.apartment.findFirst({
        where: { id, leases: { some: { tenantId: user.tenantId ?? '__none__' } } },
      });
      if (!apartment) throw new NotFoundException('Apartment not found');
      return apartment;
    }

    const allowedOwnerIds = await this.permissions.resolveAllowedOwnerIds(user);
    const apartment = await this.prisma.forOwnerScope(allowedOwnerIds).apartment.findFirst({
      where: { id },
      include: { currentLease: true },
    });
    if (!apartment) throw new NotFoundException('Apartment not found');
    return apartment;
  }

  async tenantHistory(user: AuthenticatedUser, id: string) {
    await this.findOne(user, id); // enforces the same scope check, 404s consistently
    return this.prisma.client.lease.findMany({
      where: { apartmentId: id },
      orderBy: { startDate: 'desc' },
      include: { tenant: true },
    });
  }

  async create(dto: CreateApartmentDto) {
    return this.prisma.client.apartment.create({ data: dto });
  }

  async update(id: string, dto: UpdateApartmentDto) {
    await this.assertExists(id);
    return this.prisma.client.apartment.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.client.apartment.delete({ where: { id } });
    return { success: true };
  }

  private async assertExists(id: string) {
    const apartment = await this.prisma.client.apartment.findFirst({ where: { id } });
    if (!apartment) throw new NotFoundException('Apartment not found');
  }
}
