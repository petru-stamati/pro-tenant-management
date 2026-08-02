import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../common/permissions.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { paginate, skipTake } from '../common/pagination';
import { CreateShowingDto } from './dto/create-showing.dto';
import { ListShowingsDto } from './dto/list-showings.dto';

@Injectable()
export class ShowingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  async list(user: AuthenticatedUser, query: ListShowingsDto) {
    const { page, pageSize, apartmentId } = query;
    const allowedOwnerIds = await this.permissions.resolveAllowedOwnerIds(user);
    const scoped = this.prisma.forOwnerScope(allowedOwnerIds);
    const where = { ...(apartmentId ? { apartmentId } : {}) };
    const [data, total] = await Promise.all([
      scoped.showing.findMany({ where, orderBy: { scheduledAt: 'desc' }, ...skipTake(page, pageSize) }),
      scoped.showing.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async create(dto: CreateShowingDto, createdBy: AuthenticatedUser) {
    const apartment = await this.prisma.client.apartment.findFirst({ where: { id: dto.apartmentId } });
    if (!apartment) throw new BadRequestException('Apartment not found');

    return this.prisma.client.showing.create({
      data: {
        apartmentId: dto.apartmentId,
        ownerId: apartment.ownerId,
        scheduledAt: new Date(dto.scheduledAt),
        prospectName: dto.prospectName,
        prospectContact: dto.prospectContact,
        notes: dto.notes,
        createdById: createdBy.id,
      },
    });
  }

  async remove(user: AuthenticatedUser, id: string) {
    const allowedOwnerIds = await this.permissions.resolveAllowedOwnerIds(user);
    const showing = await this.prisma.forOwnerScope(allowedOwnerIds).showing.findFirst({ where: { id } });
    if (!showing) throw new NotFoundException('Showing not found');
    await this.prisma.client.showing.delete({ where: { id } });
    return { success: true };
  }
}
