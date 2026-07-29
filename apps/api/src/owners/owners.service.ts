import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { paginate, PaginationQueryDto, skipTake } from '../common/pagination';
import { CreateOwnerDto } from './dto/create-owner.dto';
import { UpdateOwnerDto } from './dto/update-owner.dto';

@Injectable()
export class OwnersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser, query: PaginationQueryDto) {
    const { page, pageSize, search } = query;
    const where = {
      ...(user.roleKey === 'OWNER' ? { id: user.ownerId ?? '__none__' } : {}),
      ...(search
        ? {
            OR: [
              { companyName: { contains: search, mode: 'insensitive' as const } },
              { contactName: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.client.owner.findMany({ where, orderBy: { companyName: 'asc' }, ...skipTake(page, pageSize) }),
      this.prisma.client.owner.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async findOne(user: AuthenticatedUser, id: string) {
    if (user.roleKey === 'OWNER' && user.ownerId !== id) {
      // Deliberately 404, not 403 — Phase 4 §5: a row outside your scope
      // doesn't exist from your point of view, it doesn't announce itself.
      throw new NotFoundException('Owner not found');
    }
    const owner = await this.prisma.client.owner.findFirst({ where: { id } });
    if (!owner) throw new NotFoundException('Owner not found');
    return owner;
  }

  async create(dto: CreateOwnerDto) {
    return this.prisma.client.owner.create({ data: dto });
  }

  async update(id: string, dto: UpdateOwnerDto) {
    await this.assertExists(id);
    return this.prisma.client.owner.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.client.owner.delete({ where: { id } });
    return { success: true };
  }

  private async assertExists(id: string) {
    const owner = await this.prisma.client.owner.findFirst({ where: { id } });
    if (!owner) throw new NotFoundException('Owner not found');
  }
}
