import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../common/permissions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ApartmentInvoicesService } from '../apartment-invoices/apartment-invoices.service';
import { LocalStorageService } from './local-storage.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { paginate, skipTake } from '../common/pagination';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import { ListDocumentsDto } from './dto/list-documents.dto';
import { AssignInvoiceDto } from './dto/assign-invoice.dto';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly storage: LocalStorageService,
    private readonly notifications: NotificationsService,
    private readonly apartmentInvoices: ApartmentInvoicesService,
  ) {}

  async list(user: AuthenticatedUser, query: ListDocumentsDto) {
    const {
      page,
      pageSize,
      apartmentId,
      leaseId,
      category,
      utilityRecordId,
      apartmentInvoiceId,
      paymentConfirmationId,
      taskId,
      unassigned,
    } = query;
    const filters = {
      ...(apartmentId ? { apartmentId } : {}),
      ...(unassigned ? { apartmentId: null } : {}),
      ...(leaseId ? { leaseId } : {}),
      ...(category ? { category: category as never } : {}),
      ...(utilityRecordId ? { utilityRecordId } : {}),
      ...(apartmentInvoiceId ? { apartmentInvoiceId } : {}),
      ...(paymentConfirmationId ? { paymentConfirmationId } : {}),
      ...(taskId ? { taskId } : {}),
    };

    if (user.roleKey === 'TENANT') {
      const where = { ...filters, lease: { tenantId: user.tenantId ?? '__none__' } };
      const [data, total] = await Promise.all([
        this.prisma.client.document.findMany({
          where,
          include: { apartment: true, utilityRecord: true },
          orderBy: { createdAt: 'desc' },
          ...skipTake(page, pageSize),
        }),
        this.prisma.client.document.count({ where }),
      ]);
      return paginate(data, total, page, pageSize);
    }

    const allowedOwnerIds = await this.permissions.resolveAllowedOwnerIds(user);
    const scoped = this.prisma.forOwnerScope(allowedOwnerIds);
    const [data, total] = await Promise.all([
      scoped.document.findMany({
        where: filters,
        include: { apartment: true, utilityRecord: true },
        orderBy: { createdAt: 'desc' },
        ...skipTake(page, pageSize),
      }),
      scoped.document.count({ where: filters }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async createUploadUrl(dto: CreateUploadUrlDto, uploadedBy: AuthenticatedUser) {
    let ownerId = await this.resolveOwnerId(dto);

    // The Owner's bulk "upload this month's invoices" flow — no apartment
    // chosen yet, just a billing month. `ownerId` here is the caller's own
    // (never client-supplied), so this can't be used to upload into another
    // owner's unassigned pool.
    const isUnassignedOwnerInvoice =
      !ownerId && uploadedBy.roleKey === 'OWNER' && dto.category === 'INVOICE' && !!dto.periodMonth;
    if (isUnassignedOwnerInvoice) {
      ownerId = uploadedBy.ownerId ?? undefined;
    }

    if (!ownerId) {
      throw new BadRequestException(
        'Attach the document to an apartment, lease, utility record, invoice, payment confirmation, task, or maintenance request',
      );
    }

    await this.assertOwnerAccess(uploadedBy, ownerId);
    const s3Key = `${dto.category.toLowerCase()}/${randomBytes(8).toString('hex')}-${sanitize(dto.fileName)}`;

    const document = await this.prisma.client.document.create({
      data: {
        category: dto.category,
        ownerId,
        apartmentId: dto.apartmentId,
        leaseId: dto.leaseId,
        maintenanceRequestId: dto.maintenanceRequestId,
        utilityRecordId: dto.utilityRecordId,
        apartmentInvoiceId: dto.apartmentInvoiceId,
        paymentConfirmationId: dto.paymentConfirmationId,
        taskId: dto.taskId,
        periodMonth: dto.periodMonth ? new Date(`${dto.periodMonth}-01`) : undefined,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        s3Key,
        uploadedById: uploadedBy.id,
      },
    });

    if (isUnassignedOwnerInvoice) {
      await this.notifications.notifyRole(
        ownerId,
        'ADMIN',
        'INVOICES_PENDING_ASSIGNMENT',
        'New invoice uploaded — needs assigning',
        `${dto.fileName} (${dto.periodMonth}) is waiting to be assigned to an apartment.`,
        'Document',
        document.id,
      );
    }

    // Real S3 would return a presigned PUT URL here instead (Phase 3 §11).
    return { documentId: document.id, uploadUrl: `/documents/${document.id}/raw-upload`, s3Key };
  }

  /** PM's triage action — turns an Owner's unassigned invoice upload into a real ApartmentInvoice. */
  async assignInvoice(id: string, dto: AssignInvoiceDto, user: AuthenticatedUser) {
    const document = await this.assertExistsScoped(user, id);
    if (document.category !== 'INVOICE' || document.apartmentId) {
      throw new BadRequestException('Only unassigned invoice uploads can be assigned');
    }

    const invoice = await this.apartmentInvoices.create(
      {
        apartmentId: dto.apartmentId,
        type: dto.type,
        invoiceNumber: dto.invoiceNumber,
        issueDate: dto.issueDate,
        dueDate: dto.dueDate,
        periodMonth: dto.periodMonth,
        totalAmountRON: dto.totalAmountRON,
      },
      user,
    );

    await this.prisma.client.document.update({
      where: { id },
      data: { apartmentId: dto.apartmentId, apartmentInvoiceId: (invoice as { id: string }).id },
    });

    return invoice;
  }

  async receiveUpload(user: AuthenticatedUser, id: string, buffer: Buffer) {
    const document = await this.assertExistsScoped(user, id);
    await this.storage.writeFile(document.s3Key, buffer);
    return this.prisma.client.document.update({ where: { id }, data: { sizeBytes: buffer.length } });
  }

  async complete(user: AuthenticatedUser, id: string) {
    const document = await this.assertExistsScoped(user, id);
    const exists = await this.storage.fileExists(document.s3Key);
    if (!exists) throw new BadRequestException('Upload has not finished — file not found in storage yet');
    return document;
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const document = await this.scopedFind(user, id);
    if (!document) throw new NotFoundException('Document not found');
    return { ...document, downloadUrl: `/documents/${document.id}/download` };
  }

  async downloadBuffer(user: AuthenticatedUser, id: string) {
    const document = await this.scopedFind(user, id);
    if (!document) throw new NotFoundException('Document not found');
    const buffer = await this.storage.readFile(document.s3Key);
    return { buffer, fileName: document.fileName, mimeType: document.mimeType };
  }

  async newVersion(id: string, dto: CreateUploadUrlDto, uploadedBy: AuthenticatedUser) {
    const previous = await this.assertExistsScoped(uploadedBy, id);
    const ownerId = await this.resolveOwnerId({ ...dto, apartmentId: dto.apartmentId ?? previous.apartmentId ?? undefined });
    await this.assertOwnerAccess(uploadedBy, ownerId);
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
    return { documentId: document.id, uploadUrl: `/documents/${document.id}/raw-upload`, s3Key };
  }

  async remove(user: AuthenticatedUser, id: string) {
    await this.assertExistsScoped(user, id);
    await this.prisma.client.document.delete({ where: { id } });
    return { success: true };
  }

  private async resolveOwnerId(dto: {
    apartmentId?: string;
    leaseId?: string;
    maintenanceRequestId?: string;
    utilityRecordId?: string;
    apartmentInvoiceId?: string;
    paymentConfirmationId?: string;
    taskId?: string;
  }) {
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
    if (dto.utilityRecordId) {
      const record = await this.prisma.client.utilityRecord.findFirst({ where: { id: dto.utilityRecordId } });
      if (!record) throw new BadRequestException('Utility record not found');
      return record.ownerId;
    }
    if (dto.apartmentInvoiceId) {
      const invoice = await this.prisma.client.apartmentInvoice.findFirst({ where: { id: dto.apartmentInvoiceId } });
      if (!invoice) throw new BadRequestException('Invoice not found');
      return invoice.ownerId;
    }
    if (dto.paymentConfirmationId) {
      const confirmation = await this.prisma.client.paymentConfirmation.findFirst({
        where: { id: dto.paymentConfirmationId },
      });
      if (!confirmation) throw new BadRequestException('Payment confirmation not found');
      return confirmation.ownerId;
    }
    if (dto.taskId) {
      const task = await this.prisma.client.task.findFirst({ where: { id: dto.taskId } });
      if (!task) throw new BadRequestException('Task not found');
      return task.ownerId;
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

  /**
   * Write-path scoping check: `documents:write` is granted to OWNER too (they
   * upload their own invoices/lease agreements/etc), so every write must
   * verify the target's ownerId is actually within the caller's allowed set
   * — otherwise an Owner could attach/overwrite/delete another owner's
   * documents by guessing an apartment/lease/invoice id. ADMIN is
   * unrestricted, matching the read-side scoping everywhere else.
   */
  private async assertOwnerAccess(user: AuthenticatedUser, ownerId: string | undefined) {
    if (!ownerId) return;
    const allowedOwnerIds = await this.permissions.resolveAllowedOwnerIds(user);
    if (allowedOwnerIds === 'all') return;
    if (!allowedOwnerIds.includes(ownerId)) throw new ForbiddenException('Not allowed to write documents for this owner');
  }

  /** Like `scopedFind`, but 404s instead of returning null — used by the write paths above. */
  private async assertExistsScoped(user: AuthenticatedUser, id: string) {
    const document = await this.scopedFind(user, id);
    if (!document) throw new NotFoundException('Document not found');
    return document;
  }
}

function sanitize(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
}
