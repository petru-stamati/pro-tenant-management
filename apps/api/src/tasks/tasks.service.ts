import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SystemRoleKey } from '@pro-tenant/db';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../common/permissions.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { paginate, skipTake } from '../common/pagination';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ListTasksDto } from './dto/list-tasks.dto';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  async list(user: AuthenticatedUser, query: ListTasksDto) {
    const { page, pageSize, apartmentId, status } = query;
    const allowedOwnerIds = await this.permissions.resolveAllowedOwnerIds(user);
    const scoped = this.prisma.forOwnerScope(allowedOwnerIds);
    const where = {
      ...(apartmentId ? { apartmentId } : {}),
      ...(status ? { status: status as never } : {}),
    };
    const [data, total] = await Promise.all([
      scoped.task.findMany({
        where,
        include: { apartment: true, tenant: true, createdBy: true },
        // Urgent-first, then newest — this is the "what do I need to do" inbox, not a chronological log.
        orderBy: [{ urgent: 'desc' }, { createdAt: 'desc' }],
        ...skipTake(page, pageSize),
      }),
      scoped.task.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const task = await this.scopedFind(user, id, {
      apartment: true,
      tenant: true,
      createdBy: true,
      comments: { orderBy: { createdAt: 'asc' }, include: { author: true } },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async create(dto: CreateTaskDto, createdBy: AuthenticatedUser) {
    let ownerId: string;
    let assignedToRole: SystemRoleKey;

    if (createdBy.roleKey === 'OWNER') {
      if (!createdBy.ownerId) throw new ForbiddenException('No owner company linked to this account');
      ownerId = createdBy.ownerId;
      assignedToRole = 'ADMIN'; // an Owner can only delegate to the PM
    } else {
      if (!dto.ownerId) throw new BadRequestException('ownerId is required');
      ownerId = dto.ownerId;
      assignedToRole = dto.assignedToRole ?? 'OWNER';
    }

    if (dto.apartmentId) {
      const apartment = await this.prisma.client.apartment.findFirst({ where: { id: dto.apartmentId } });
      if (!apartment) throw new BadRequestException('Apartment not found');
      if (apartment.ownerId !== ownerId) throw new BadRequestException('Apartment does not belong to this owner');
    }

    return this.prisma.client.task.create({
      data: {
        ownerId,
        apartmentId: dto.apartmentId,
        tenantId: dto.tenantId,
        title: dto.title,
        description: dto.description,
        urgent: dto.urgent ?? false,
        assignedToRole,
        createdById: createdBy.id,
      },
    });
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateTaskDto) {
    await this.assertExistsScoped(user, id);
    return this.prisma.client.task.update({ where: { id }, data: dto });
  }

  async createComment(user: AuthenticatedUser, id: string, dto: CreateTaskCommentDto) {
    await this.assertExistsScoped(user, id);
    return this.prisma.client.taskComment.create({
      data: { taskId: id, body: dto.body, authorId: user.id },
    });
  }

  private async scopedFind(user: AuthenticatedUser, id: string, include?: Record<string, unknown>) {
    const allowedOwnerIds = await this.permissions.resolveAllowedOwnerIds(user);
    return this.prisma.forOwnerScope(allowedOwnerIds).task.findFirst({ where: { id }, include: include as never });
  }

  private async assertExistsScoped(user: AuthenticatedUser, id: string) {
    const task = await this.scopedFind(user, id);
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }
}
