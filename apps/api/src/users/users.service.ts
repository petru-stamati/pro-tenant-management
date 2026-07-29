import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../common/permissions.service';
import { paginate, skipTake } from '../common/pagination';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';
import { ListUsersDto } from './dto/list-users.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  async list(query: ListUsersDto) {
    const { page, pageSize, search, roleKey } = query;
    const where = {
      ...(roleKey ? { role: { key: roleKey as never } } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' as const } },
              { lastName: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.client.user.findMany({
        where,
        select: {
          id: true, email: true, firstName: true, lastName: true, status: true,
          ownerId: true, tenantId: true, lastLoginAt: true, createdAt: true,
          role: { select: { id: true, key: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        ...skipTake(page, pageSize),
      }),
      this.prisma.client.user.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.client.user.findFirst({ where: { email: dto.email } });
    if (existing) throw new BadRequestException('A user with this email already exists');

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    return this.prisma.client.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        roleId: dto.roleId,
        status: 'ACTIVE',
      },
      select: { id: true, email: true, firstName: true, lastName: true, status: true, role: true },
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.assertExists(id);
    const updated = await this.prisma.client.user.update({
      where: { id },
      data: dto,
      select: { id: true, email: true, firstName: true, lastName: true, status: true, phone: true },
    });
    if (dto.status === 'DISABLED') {
      // Bumping tokenVersion invalidates every outstanding access token instantly (Phase 4 §1).
      await this.prisma.client.user.update({ where: { id }, data: { tokenVersion: { increment: 1 } } });
    }
    return updated;
  }

  async updatePermissions(id: string, dto: UpdatePermissionsDto) {
    await this.assertExists(id);

    for (const grant of dto.grants ?? []) {
      const permission = await this.prisma.client.permission.findFirst({ where: { key: grant.permissionKey } });
      if (!permission) throw new BadRequestException(`Unknown permission key: ${grant.permissionKey}`);
      const existing = await this.prisma.client.userPermission.findFirst({
        where: { userId: id, permissionId: permission.id, ownerId: grant.ownerId ?? null },
      });
      if (!existing) {
        await this.prisma.client.userPermission.create({
          data: { userId: id, permissionId: permission.id, ownerId: grant.ownerId },
        });
      }
    }

    for (const revoke of dto.revokes ?? []) {
      const permission = await this.prisma.client.permission.findFirst({ where: { key: revoke.permissionKey } });
      if (!permission) continue;
      await this.prisma.client.userPermission.deleteMany({
        where: { userId: id, permissionId: permission.id, ownerId: revoke.ownerId ?? null },
      });
    }

    this.permissions.invalidate(id);
    return this.prisma.client.userPermission.findMany({
      where: { userId: id },
      include: { permission: true },
    });
  }

  private async assertExists(id: string) {
    const user = await this.prisma.client.user.findFirst({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
