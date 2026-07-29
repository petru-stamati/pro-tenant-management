import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { paginate, PaginationQueryDto, skipTake } from '../common/pagination';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, Phase 4 §3

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PaginationQueryDto) {
    const { page, pageSize, search } = query;
    const where = search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const [data, total] = await Promise.all([
      this.prisma.client.tenant.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake(page, pageSize) }),
      this.prisma.client.tenant.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async findOne(id: string) {
    const tenant = await this.prisma.client.tenant.findFirst({
      where: { id },
      include: { leases: { include: { apartment: true, owner: true } } },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  /** Idempotent on email — PRD §3.2: a repeat tenant gets linked, never duplicated. */
  async create(dto: CreateTenantDto) {
    const existing = await this.prisma.client.tenant.findFirst({ where: { email: dto.email } });
    if (existing) return existing;
    return this.prisma.client.tenant.create({ data: dto });
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.assertExists(id);
    return this.prisma.client.tenant.update({ where: { id }, data: dto });
  }

  async invite(tenantId: string, leaseId: string, invitedBy: AuthenticatedUser) {
    const tenant = await this.assertExists(tenantId);
    const lease = await this.prisma.client.lease.findFirst({ where: { id: leaseId, tenantId } });
    if (!lease) throw new BadRequestException('Lease not found for this tenant');

    const rawToken = randomBytes(32).toString('hex');
    const invite = await this.prisma.client.tenantInvite.create({
      data: {
        tenantId,
        leaseId,
        email: tenant.email,
        token: hashToken(rawToken),
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        invitedById: invitedBy.id,
      },
    });
    await this.prisma.client.auditLog.create({
      data: { actorId: invitedBy.id, entityType: 'TenantInvite', entityId: invite.id, action: 'INVITE_SENT' },
    });

    // TODO(Phase 5, email provider): send `inviteLink` by email instead of
    // returning it — no SMTP/SES provider has been chosen yet. Returned here
    // so the PM can share it manually in the meantime.
    return { inviteId: invite.id, inviteLink: `/accept-invite?token=${rawToken}`, expiresAt: invite.expiresAt };
  }

  async resendInvite(id: string, invitedBy: AuthenticatedUser) {
    const invite = await this.prisma.client.tenantInvite.findFirst({ where: { id, status: 'PENDING' } });
    if (!invite) throw new NotFoundException('Pending invite not found');

    const rawToken = randomBytes(32).toString('hex');
    await this.prisma.client.tenantInvite.update({
      where: { id },
      data: { token: hashToken(rawToken), expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
    });
    await this.prisma.client.auditLog.create({
      data: { actorId: invitedBy.id, entityType: 'TenantInvite', entityId: id, action: 'INVITE_SENT' },
    });
    return { inviteId: id, inviteLink: `/accept-invite?token=${rawToken}` };
  }

  async revokeInvite(id: string) {
    const invite = await this.prisma.client.tenantInvite.findFirst({ where: { id, status: 'PENDING' } });
    if (!invite) throw new NotFoundException('Pending invite not found');
    await this.prisma.client.tenantInvite.update({ where: { id }, data: { status: 'REVOKED' } });
    return { success: true };
  }

  private async assertExists(id: string) {
    const tenant = await this.prisma.client.tenant.findFirst({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
