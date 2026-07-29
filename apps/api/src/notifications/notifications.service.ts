import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@pro-tenant/db';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, skipTake } from '../common/pagination';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: ListNotificationsDto) {
    const { page, pageSize, unreadOnly } = query;
    const where = { userId, ...(unreadOnly ? { readAt: null } : {}) };
    const [data, total, unreadCount] = await Promise.all([
      this.prisma.client.notification.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake(page, pageSize) }),
      this.prisma.client.notification.count({ where }),
      this.prisma.client.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { ...paginate(data, total, page, pageSize), unreadCount };
  }

  async markRead(userId: string, id: string) {
    const notification = await this.prisma.client.notification.findFirst({ where: { id, userId } });
    if (!notification) throw new NotFoundException('Notification not found');
    return this.prisma.client.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  async markAllRead(userId: string) {
    await this.prisma.client.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  async registerPushToken(userId: string, dto: RegisterPushTokenDto) {
    return this.prisma.client.pushDeviceToken.upsert({
      where: { token: dto.token },
      update: { userId, platform: dto.platform, revokedAt: null },
      create: { userId, token: dto.token, platform: dto.platform },
    });
  }

  async unregisterPushToken(token: string) {
    await this.prisma.client.pushDeviceToken.updateMany({
      where: { token },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  /**
   * Internal API for other services/background jobs to call — no HTTP
   * endpoint creates a Notification directly (Phase 3 §15). The actual
   * triggers (lease expiring, invoice overdue, etc. — PRD §4.13) are
   * scheduled jobs that need BullMQ/Redis, not provisioned on this machine
   * yet (see packages/db/README.md); this is the seam they'll call into.
   */
  async create(userId: string, type: NotificationType, title: string, body: string, entityType?: string, entityId?: string) {
    return this.prisma.client.notification.create({
      data: { userId, type, title, body, entityType, entityId },
    });
  }
}
