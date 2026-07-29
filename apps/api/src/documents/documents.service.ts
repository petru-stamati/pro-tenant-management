import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../common/permissions.service';
import { LocalStorageService } from './local-storage.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { paginate, skipTake } from '../common/pagination';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import { ListDocumentsDto } from './dto/list-documents.dto';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly storage: LocalStorageService,
  ) {}

  async list(user: AuthenticatedUser, query: ListDocumentsDto) {
    const { page, pageSize, apartmentId, leaseId, category } = query;
    const filters = {
      ...(apartmentId ? { apartmentId } : {}),
      ...(leaseId ? { leaseId } : {}),
      ...(category ? { category: category as never } : {}),
    };

    if (user.roleKey === 'TENANT') {
      const where = { ...filters, lease: { tenantId: user.tenantId ?? '__none__' } };
      const [data, total] = await Promise.all([
        this.prisma.client.document.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake(page, pageSize) }),
        this.prisma.client.document.count({ where }),
      ]);
      return paginate(data, total, page, pageSize);
    }

    const allowedOwnerIds = await this.permissions.resolveAllowedOwnerIds(user);
    const scoped = this.prisma.forOwnerScope(allowedOwnerIds);
    const [data, total] = await Promise.all([
      scoped.document.findMany({ where: filters, orderBy: { createdAt: 'desc' }, ...skipTake(page, pageSize) }),
      scoped.document.count({ where: filters }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async createUploadUrl(dto: CreateUploadUrlDto, uploadedBy: AuthenticatedUser) {
    if (!dto.apartmentId && !dto.leaseId && !dto.maintenanceRequestId) {
      throw new BadRequestException('Attach the document to an apartment, lease, or maintenance request');
    }

    const ownerId = await this.resolveOwnerId(dto);
    const s3Key = `${dto.category.toLowerCase()}/${randomBytes(8).toString('hex')}-${sanitize(dto.fileName)}`;

    const document = await this.prisma.client.document.create({
      data: {
        category: dto.category,
        ownerId,
        apartmentId: dto.apartmentId,
        leaseId: dto.leaseId,
        maintenanceRequestId: dto.maintenanceRequestId,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        s3Key,
        uploadedById: uploadedBy.id,
      },
    });

    // Real S3 would return a presigned PUT URL here instead (Phase 3 §11).
    return { documentId: document.id, uploadUrl: `/v1/documents/${document.id}/raw-upload`, s3Key };
  }

  async receiveUpload(id: string, buffer: Buffer) {
    const document = await this.assertExists(id);
    await this.storage.writeFile(document.s3Key, buffer);
    return this.prisma.client.document.update({ where: { id }, data: { sizeBytes: buffer.length } });
  }

  async complete(id: string) {
    const document = await this.assertExists(id);
    const exists = await this.storage.fileExists(document.s3Key);
    if (!exists) throw new BadRequestException('Upload has not finished — file not found in storage yet');
    return document;
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const document = await this.scopedFind(user, id);
    if (!document) throw new NotFoundException('Document not found');
    return { ...document, downloadUrl: `/v1/documents/${document.id}/download` };
  }

  async downloadBuffer(user: AuthenticatedUser, id: string) {
    const document = await this.scopedFind(user, id);
    if (!document) throw new NotFoundException('Document not found');
    const buffer = await this.storage.readFile(document.s3Key);
    return { buffer, fileName: document.fileName, mimeType: document.mimeType };
  }

  async newVersion(id: string, dto: CreateUploadUrlDto, uploadedBy: AuthenticatedUser) {
    const previous = await this.assertExists(id);
    const ownerId = await this.resolveOwnerId({ ...dto, apartmentId: dto.apartmentId ?? previous.apartmentId ?? undefined });
    const s3Key = `${previous.category.toLowerCase()}/${randomBytes(8).toString('hex')}-${sanitize(dto.fileName)}`;

    const document = await this.prisma.client.document.create({
      data: {
        category: previous.category,
        ownerId,
        apartmentId: previous.apartmentId,
        leaseId: previous.leaseId,
        maintenanceRequestId: previous.maintenanceRequestId,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        s3Key,
        version: previous.version + 1,
        previousVersionId: previous.id,
        uploadedById: uploadedBy.id,
      },
    });
    return { documentId: document.id, uploadUrl: `/v1/documents/${document.id}/raw-upload`, s3Key };
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.client.document.delete({ where: { id } });
    return { success: true };
  }

  private async resolveOwnerId(dto: { apartmentId?: string; leaseId?: string; maintenanceRequestId?: string }) {
    if (dto.apartmentId) {
      const apartment = await this.prisma.client.apartment.findFirst({ where: { id: dto.apartmentId } });
      if (!apartment) throw new BadRequestException('Apartment not found');
      return apartment.ownerId;
    }
    if (dto.leaseId) {
      const lease = await this.prisma.client.lease.findFirst({ where: { id: dto.leaseId } });
      if (!lease) throw new BadRequestException('Lease not found');
      return lease.ownerId;
    }
    if (dto.maintenanceRequestId) {
      const request = await this.prisma.client.maintenanceRequest.findFirst({ where: { id: dto.maintenanceRequestId } });
      if (!request) throw new BadRequestException('Maintenance request not found');
      return request.ownerId;
    }
    return undefined;
  }

  private async scopedFind(user: AuthenticatedUser, id: string) {
    if (user.roleKey === 'TENANT') {
      return this.prisma.client.document.findFirst({
        where: { id, lease: { tenantId: user.tenantId ?? '__none__' } },
      });
    }
    const allowedOwnerIds = await this.permissions.resolveAllowedOwnerIds(user);
    return this.prisma.forOwnerScope(allowedOwnerIds).document.findFirst({ where: { id } });
  }

  private async assertExists(id: string) {
    const document = await this.prisma.client.document.findFirst({ where: { id } });
    if (!document) throw new NotFoundException('Document not found');
    return document;
  }
}

function sanitize(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
}
