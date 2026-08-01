import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../common/permissions.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { paginate, skipTake } from '../common/pagination';
import { CreateLeaseDto } from './dto/create-lease.dto';
import { UpdateLeaseDto } from './dto/update-lease.dto';
import { RenewLeaseDto } from './dto/renew-lease.dto';
import { ListLeasesDto } from './dto/list-leases.dto';

@Injectable()
export class LeasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  async list(user: AuthenticatedUser, query: ListLeasesDto) {
    const { page, pageSize, apartmentId, status } = query;

    if (user.roleKey === 'TENANT') {
      const where = { tenantId: user.tenantId ?? '__none__', ...(status ? { status: status as never } : {}) };
      const [data, total] = await Promise.all([
        this.prisma.client.lease.findMany({
          where,
          include: { apartment: true, owner: true },
          orderBy: { startDate: 'desc' },
          ...skipTake(page, pageSize),
        }),
        this.prisma.client.lease.count({ where }),
      ]);
      return paginate(data, total, page, pageSize);
    }

    const allowedOwnerIds = await this.permissions.resolveAllowedOwnerIds(user);
    const scoped = this.prisma.forOwnerScope(allowedOwnerIds);
    const where = {
      ...(apartmentId ? { apartmentId } : {}),
      ...(status ? { status: status as never } : {}),
    };
    const [data, total] = await Promise.all([
      scoped.lease.findMany({
        where,
        include: { apartment: true, tenant: true },
        orderBy: { startDate: 'desc' },
        ...skipTake(page, pageSize),
      }),
      scoped.lease.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async findOne(user: AuthenticatedUser, id: string) {
    if (user.roleKey === 'TENANT') {
      const lease = await this.prisma.client.lease.findFirst({
        where: { id, tenantId: user.tenantId ?? '__none__' },
        include: { apartment: true, owner: true },
      });
      if (!lease) throw new NotFoundException('Lease not found');
      return lease;
    }

    const allowedOwnerIds = await this.permissions.resolveAllowedOwnerIds(user);
    const lease = await this.prisma.forOwnerScope(allowedOwnerIds).lease.findFirst({
      where: { id },
      include: { apartment: true, tenant: true },
    });
    if (!lease) throw new NotFoundException('Lease not found');
    return lease;
  }

  async create(dto: CreateLeaseDto, createdBy: AuthenticatedUser) {
    const apartment = await this.prisma.client.apartment.findFirst({ where: { id: dto.apartmentId } });
    if (!apartment) throw new BadRequestException('Apartment not found');
    if ((dto.status ?? 'DRAFT') === 'ACTIVE' && apartment.currentLeaseId) {
      throw new BadRequestException('Apartment already has an active lease — terminate it first');
    }

    return this.prisma.client.$transaction(async (tx) => {
      const lease = await tx.lease.create({
        data: {
          apartmentId: dto.apartmentId,
          ownerId: apartment.ownerId,
          tenantId: dto.tenantId,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          rentAmountEUR: dto.rentAmountEUR,
          rentVatIncluded: dto.rentVatIncluded ?? true,
          termMonths: dto.termMonths,
          depositAmountEUR: dto.depositAmountEUR,
          status: dto.status ?? 'DRAFT',
          createdById: createdBy.id,
        },
      });

      if (lease.status === 'ACTIVE') {
        await tx.apartment.update({
          where: { id: apartment.id },
          data: { currentLeaseId: lease.id, status: 'OCCUPIED' },
        });
      }
      return lease;
    });
  }

  async update(id: string, dto: UpdateLeaseDto) {
    const lease = await this.assertExists(id);
    return this.prisma.client.lease.update({
      where: { id: lease.id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  /** Creates a new Lease row linked via renewedFromLeaseId — the old row is never edited (PRD §4.5). */
  async renew(id: string, dto: RenewLeaseDto, createdBy: AuthenticatedUser) {
    const lease = await this.assertExists(id);

    return this.prisma.client.$transaction(async (tx) => {
      const renewed = await tx.lease.create({
        data: {
          apartmentId: lease.apartmentId,
          ownerId: lease.ownerId,
          tenantId: lease.tenantId,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          rentAmountEUR: dto.rentAmountEUR,
          depositAmountEUR: lease.depositAmountEUR,
          depositStatus: lease.depositStatus,
          status: 'ACTIVE',
          renewedFromLeaseId: lease.id,
          createdById: createdBy.id,
        },
      });
      await tx.lease.update({ where: { id: lease.id }, data: { status: 'ENDED' } });
      await tx.apartment.update({
        where: { id: lease.apartmentId },
        data: { currentLeaseId: renewed.id, status: 'OCCUPIED' },
      });
      return renewed;
    });
  }

  async terminate(id: string, reason: string) {
    const lease = await this.assertExists(id);

    return this.prisma.client.$transaction(async (tx) => {
      const terminated = await tx.lease.update({
        where: { id: lease.id },
        data: { status: 'TERMINATED', terminationReason: reason },
      });

      const apartment = await tx.apartment.findFirst({ where: { id: lease.apartmentId } });
      if (apartment?.currentLeaseId === lease.id) {
        await tx.apartment.update({
          where: { id: apartment.id },
          data: { currentLeaseId: null, status: 'VACANT' },
        });
      }
      return terminated;
    });
  }

  private async assertExists(id: string) {
    const lease = await this.prisma.client.lease.findFirst({ where: { id } });
    if (!lease) throw new NotFoundException('Lease not found');
    return lease;
  }
}
