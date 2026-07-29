import * as argon2 from 'argon2';
import { PrismaService } from '../../src/prisma/prisma.service';

export const TEST_PASSWORD = 'TestPassword123!';

let passwordHashCache: string | undefined;
async function testPasswordHash(): Promise<string> {
  passwordHashCache ??= await argon2.hash(TEST_PASSWORD, { type: argon2.argon2id });
  return passwordHashCache;
}

export async function createOwner(prisma: PrismaService, overrides: { companyName?: string } = {}) {
  return prisma.client.owner.create({
    data: {
      companyName: overrides.companyName ?? `Test Owner ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      contactName: 'Test Contact',
      email: `owner-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`,
    },
  });
}

export async function createApartment(
  prisma: PrismaService,
  ownerId: string,
  overrides: { name?: string; status?: string } = {},
) {
  return prisma.client.apartment.create({
    data: {
      ownerId,
      name: overrides.name ?? `Test Apartment ${Date.now()}`,
      addressLine: 'Str. Test 1',
      city: 'Bucharest',
      status: (overrides.status as never) ?? 'VACANT',
    },
  });
}

export async function createTenant(prisma: PrismaService, overrides: { firstName?: string; lastName?: string; email?: string } = {}) {
  return prisma.client.tenant.create({
    data: {
      firstName: overrides.firstName ?? 'Test',
      lastName: overrides.lastName ?? 'Tenant',
      email: overrides.email ?? `tenant-${Date.now()}@example.test`,
    },
  });
}

interface CreateUserOptions {
  email: string;
  roleKey: 'ADMIN' | 'OWNER' | 'TENANT';
  ownerId?: string;
  tenantId?: string;
  status?: 'ACTIVE' | 'DISABLED';
}

export async function createUser(prisma: PrismaService, options: CreateUserOptions) {
  const role = await prisma.client.role.findFirstOrThrow({ where: { key: options.roleKey } });
  return prisma.client.user.create({
    data: {
      email: options.email,
      passwordHash: await testPasswordHash(),
      firstName: 'Test',
      lastName: options.roleKey,
      roleId: role.id,
      ownerId: options.ownerId,
      tenantId: options.tenantId,
      status: options.status ?? 'ACTIVE',
    },
  });
}

export async function createLease(
  prisma: PrismaService,
  params: { apartmentId: string; ownerId: string; tenantId: string; createdById: string; status?: string; rentAmountEUR?: number },
) {
  return prisma.client.lease.create({
    data: {
      apartmentId: params.apartmentId,
      ownerId: params.ownerId,
      tenantId: params.tenantId,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2027-01-01'),
      rentAmountEUR: params.rentAmountEUR ?? 500,
      depositAmountEUR: params.rentAmountEUR ?? 500,
      status: (params.status as never) ?? 'ACTIVE',
      createdById: params.createdById,
    },
  });
}
