import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { id: 'pm-1', roleKey: 'ADMIN', ownerId: null, tenantId: null, tokenVersion: 0, ...overrides };
}

function makePrisma() {
  return {
    client: {
      apartment: { findFirst: jest.fn() },
      lease: { findFirst: jest.fn() },
      maintenanceRequest: { findFirst: jest.fn() },
      document: {
        create: jest.fn((args) => ({ id: 'doc-1', version: 1, ...args.data })),
        update: jest.fn((args) => ({ id: args.where.id, ...args.data })),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
      },
    },
    forOwnerScope: jest.fn(),
  };
}

function makePermissions(allowedOwnerIds: string[] | 'all' = 'all') {
  return { resolveAllowedOwnerIds: jest.fn().mockResolvedValue(allowedOwnerIds) };
}

function makeStorage() {
  return { writeFile: jest.fn(), readFile: jest.fn(), fileExists: jest.fn() };
}

describe('DocumentsService.createUploadUrl', () => {
  it('requires the document to be attached to an apartment, lease, or maintenance request', async () => {
    const prisma = makePrisma();
    const service = new DocumentsService(prisma as never, makePermissions() as never, makeStorage() as never);

    await expect(
      service.createUploadUrl({ category: 'CONTRACT', fileName: 'x.pdf', mimeType: 'application/pdf', sizeBytes: 10 } as never, makeUser({})),
    ).rejects.toThrow(BadRequestException);
  });

  it('resolves ownerId from the apartment when apartmentId is given', async () => {
    const prisma = makePrisma();
    prisma.client.apartment.findFirst.mockResolvedValue({ id: 'apt-1', ownerId: 'owner-1' });
    const service = new DocumentsService(prisma as never, makePermissions() as never, makeStorage() as never);

    const result = await service.createUploadUrl(
      { apartmentId: 'apt-1', category: 'CONTRACT', fileName: 'lease-signed.pdf', mimeType: 'application/pdf', sizeBytes: 16 } as never,
      makeUser({}),
    );
    expect(prisma.client.document.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ownerId: 'owner-1' }) }),
    );
    // No leading /v1 — the frontend's API_URL already includes it; baking it in
    // here too caused a real doubled-prefix 404 bug on the actual upload button.
    expect(result.uploadUrl).toBe(`/documents/${result.documentId}/raw-upload`);
  });

  it('rejects an apartmentId that does not exist', async () => {
    const prisma = makePrisma();
    prisma.client.apartment.findFirst.mockResolvedValue(null);
    const service = new DocumentsService(prisma as never, makePermissions() as never, makeStorage() as never);

    await expect(
      service.createUploadUrl(
        { apartmentId: 'ghost', category: 'CONTRACT', fileName: 'x.pdf', mimeType: 'application/pdf', sizeBytes: 10 } as never,
        makeUser({}),
      ),
    ).rejects.toThrow('Apartment not found');
  });

  it('strips path separators and shell-unsafe characters from the fileName portion of the s3Key', async () => {
    const prisma = makePrisma();
    prisma.client.apartment.findFirst.mockResolvedValue({ id: 'apt-1', ownerId: 'owner-1' });
    const service = new DocumentsService(prisma as never, makePermissions() as never, makeStorage() as never);

    await service.createUploadUrl(
      { apartmentId: 'apt-1', category: 'CONTRACT', fileName: '../../etc/passwd; rm -rf.pdf', mimeType: 'application/pdf', sizeBytes: 10 } as never,
      makeUser({}),
    );
    const callArgs = (prisma.client.document.create as jest.Mock).mock.calls[0][0];
    // key is "<category>/<hex>-<sanitized fileName>" — only the leading category/ separator is a legitimate slash
    const fileNamePortion = (callArgs.data.s3Key as string).split('/').slice(1).join('/');
    expect(fileNamePortion).not.toMatch(/[/;\s]/);
  });
});

describe('DocumentsService.complete', () => {
  it('refuses to finalize a document whose file has not actually landed in storage', async () => {
    const prisma = makePrisma();
    const scoped = { document: { findFirst: jest.fn().mockResolvedValue({ id: 'doc-1', s3Key: 'contract/abc-x.pdf' }) } };
    (prisma.forOwnerScope as jest.Mock).mockReturnValue(scoped);
    const storage = makeStorage();
    storage.fileExists.mockResolvedValue(false);
    const service = new DocumentsService(prisma as never, makePermissions() as never, storage as never);

    await expect(service.complete(makeUser({}), 'doc-1')).rejects.toThrow('Upload has not finished');
  });

  it('succeeds once the file is confirmed present', async () => {
    const prisma = makePrisma();
    const scoped = { document: { findFirst: jest.fn().mockResolvedValue({ id: 'doc-1', s3Key: 'contract/abc-x.pdf' }) } };
    (prisma.forOwnerScope as jest.Mock).mockReturnValue(scoped);
    const storage = makeStorage();
    storage.fileExists.mockResolvedValue(true);
    const service = new DocumentsService(prisma as never, makePermissions() as never, storage as never);

    await expect(service.complete(makeUser({}), 'doc-1')).resolves.toMatchObject({ id: 'doc-1' });
  });

  it('404s instead of completing when the document is outside the caller owner scope', async () => {
    const prisma = makePrisma();
    const scoped = { document: { findFirst: jest.fn().mockResolvedValue(null) } };
    (prisma.forOwnerScope as jest.Mock).mockReturnValue(scoped);
    const storage = makeStorage();
    const service = new DocumentsService(prisma as never, makePermissions(['owner-1']) as never, storage as never);

    await expect(
      service.complete(makeUser({ roleKey: 'OWNER', ownerId: 'owner-1' }), 'doc-belonging-to-other-owner'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('DocumentsService tenant vs PM/owner scoping', () => {
  it('scopes a TENANT to documents on leases they hold, not documents in general', async () => {
    const prisma = makePrisma();
    prisma.client.document.findFirst.mockResolvedValue({ id: 'doc-1', s3Key: 'contract/x.pdf', fileName: 'lease.pdf', mimeType: 'application/pdf' });
    const storage = makeStorage();
    storage.readFile.mockResolvedValue(Buffer.from('data'));
    const service = new DocumentsService(prisma as never, makePermissions() as never, storage as never);

    await service.downloadBuffer(makeUser({ roleKey: 'TENANT', tenantId: 'tenant-1' }), 'doc-1');

    expect(prisma.client.document.findFirst).toHaveBeenCalledWith({
      where: { id: 'doc-1', lease: { tenantId: 'tenant-1' } },
    });
  });

  it('returns NotFoundException (not the raw file) when the tenant scope excludes the document', async () => {
    const prisma = makePrisma();
    prisma.client.document.findFirst.mockResolvedValue(null);
    const storage = makeStorage();
    const service = new DocumentsService(prisma as never, makePermissions() as never, storage as never);

    await expect(
      service.downloadBuffer(makeUser({ roleKey: 'TENANT', tenantId: 'tenant-1' }), 'doc-not-mine'),
    ).rejects.toThrow(NotFoundException);
    expect(storage.readFile).not.toHaveBeenCalled();
  });

  it('routes PM/owner lookups through the owner-scope client, not the raw client', async () => {
    const prisma = makePrisma();
    const scoped = { document: { findFirst: jest.fn().mockResolvedValue({ id: 'doc-1', s3Key: 'k', fileName: 'f.pdf', mimeType: 'application/pdf' }) } };
    (prisma.forOwnerScope as jest.Mock).mockReturnValue(scoped);
    const storage = makeStorage();
    storage.readFile.mockResolvedValue(Buffer.from('data'));
    const service = new DocumentsService(prisma as never, makePermissions(['owner-1']) as never, storage as never);

    await service.downloadBuffer(makeUser({ roleKey: 'OWNER', ownerId: 'owner-1' }), 'doc-1');

    expect(scoped.document.findFirst).toHaveBeenCalledWith({ where: { id: 'doc-1' } });
    expect(prisma.client.document.findFirst).not.toHaveBeenCalled();
  });
});

describe('DocumentsService.newVersion', () => {
  it('increments the version number and links previousVersionId, inheriting the parent category/attachment', async () => {
    const prisma = makePrisma();
    const scoped = {
      document: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'doc-1',
          category: 'CONTRACT',
          ownerId: 'owner-1',
          apartmentId: 'apt-1',
          leaseId: null,
          maintenanceRequestId: null,
          version: 2,
        }),
      },
    };
    (prisma.forOwnerScope as jest.Mock).mockReturnValue(scoped);
    prisma.client.apartment.findFirst.mockResolvedValue({ id: 'apt-1', ownerId: 'owner-1' });
    const service = new DocumentsService(prisma as never, makePermissions() as never, makeStorage() as never);

    await service.newVersion('doc-1', { fileName: 'lease-v2.pdf', mimeType: 'application/pdf', sizeBytes: 20 } as never, makeUser({}));

    expect(prisma.client.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ version: 3, previousVersionId: 'doc-1', category: 'CONTRACT' }),
      }),
    );
  });
});

describe('DocumentsService write-path owner scoping', () => {
  it('rejects createUploadUrl when the target apartment belongs to a different owner than the caller', async () => {
    const prisma = makePrisma();
    prisma.client.apartment.findFirst.mockResolvedValue({ id: 'apt-1', ownerId: 'owner-2' });
    const service = new DocumentsService(prisma as never, makePermissions(['owner-1']) as never, makeStorage() as never);

    await expect(
      service.createUploadUrl(
        { apartmentId: 'apt-1', category: 'CONTRACT', fileName: 'x.pdf', mimeType: 'application/pdf', sizeBytes: 10 } as never,
        makeUser({ roleKey: 'OWNER', ownerId: 'owner-1' }),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.client.document.create).not.toHaveBeenCalled();
  });

  it('allows an ADMIN to upload against any owner', async () => {
    const prisma = makePrisma();
    prisma.client.apartment.findFirst.mockResolvedValue({ id: 'apt-1', ownerId: 'owner-2' });
    const service = new DocumentsService(prisma as never, makePermissions('all') as never, makeStorage() as never);

    await expect(
      service.createUploadUrl(
        { apartmentId: 'apt-1', category: 'CONTRACT', fileName: 'x.pdf', mimeType: 'application/pdf', sizeBytes: 10 } as never,
        makeUser({ roleKey: 'ADMIN' }),
      ),
    ).resolves.toMatchObject({ documentId: 'doc-1' });
  });

  it('404s remove() when the document is outside the caller owner scope, instead of deleting it', async () => {
    const prisma = makePrisma();
    const scoped = { document: { findFirst: jest.fn().mockResolvedValue(null) } };
    (prisma.forOwnerScope as jest.Mock).mockReturnValue(scoped);
    const service = new DocumentsService(prisma as never, makePermissions(['owner-1']) as never, makeStorage() as never);

    await expect(
      service.remove(makeUser({ roleKey: 'OWNER', ownerId: 'owner-1' }), 'doc-belonging-to-other-owner'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.client.document.delete).not.toHaveBeenCalled();
  });
});
