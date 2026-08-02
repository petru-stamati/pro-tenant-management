/**
 * Seeds the ADMIN / OWNER / TENANT roles and the full permission catalog
 * from Phase 4 §6. Idempotent — safe to re-run.
 *
 * Run with: npm run db:seed (from packages/db)
 */
import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const PERMISSIONS: Record<string, string> = {
  'users:read': 'List accounts',
  'users:write': 'Create/edit accounts',
  'users:manage-permissions': 'Grant/revoke individual permission flags',
  'owners:read': 'View owner company records',
  'owners:write': 'Create/edit owner companies',
  'apartments:read': 'View apartment records',
  'apartments:write': 'Create/edit/delete apartments',
  'tenants:read': 'View tenant profiles',
  'tenants:write': 'Manage tenant profiles & invites',
  'leases:read': 'View lease terms',
  'leases:write': 'Create/edit/renew/terminate leases',
  'payments:read': 'View rent ledger',
  'payments:write': 'Record payments, generate invoices',
  'invoices:read': 'View RON invoices',
  'invoices:write': 'Upload/create apartment invoices (rent, utilities, or both)',
  'utilities:read': 'View utility records',
  'utilities:write': 'Log readings & invoices',
  'documents:read': 'View/download documents',
  'documents:write': 'Upload, version, delete documents',
  'search:read': 'Global cross-entity search',
  'maintenance:read': 'View maintenance requests',
  'maintenance:report': 'File a new maintenance issue',
  'maintenance:manage': 'Triage, create proposals, change status',
  'maintenance:approve': 'Approve/reject a repair proposal',
  'maintenance:comment': 'Comment on requests/proposals',
  'tasks:read': 'View the Tasks inbox',
  'tasks:write': 'Create tasks, comment, change status, upload attachments',
  'showings:read': 'View logged apartment showings',
  'showings:write': 'Log a showing',
  'notes:read': 'View internal notes',
  'notes:write': 'Create internal notes',
  'analytics:read': 'Own-portfolio KPIs',
  'analytics:read-global': 'Portfolio-wide analytics',
  'audit:read': 'View the audit log',
};

const OWNER_BUNDLE = [
  'owners:read',
  'apartments:read',
  'leases:read',
  'leases:write',
  'payments:read',
  'invoices:read',
  'invoices:write',
  'utilities:read',
  'documents:read',
  'documents:write',
  'maintenance:read',
  'maintenance:approve',
  'maintenance:comment',
  'tasks:read',
  'tasks:write',
  'showings:read',
  'showings:write',
  'analytics:read',
];

const TENANT_BUNDLE = [
  'apartments:read',
  'leases:read',
  'invoices:read',
  'documents:read',
  'maintenance:read',
  'maintenance:report',
];

async function main() {
  const permissionRecords = await Promise.all(
    Object.entries(PERMISSIONS).map(([key, description]) =>
      prisma.permission.upsert({
        where: { key },
        update: { description },
        create: { key, description },
      }),
    ),
  );
  const permissionIdByKey = new Map(permissionRecords.map((p) => [p.key, p.id]));

  const adminRole = await prisma.role.upsert({
    where: { key: 'ADMIN' },
    update: {},
    create: { key: 'ADMIN', name: 'Property Manager', isSystem: true },
  });
  const ownerRole = await prisma.role.upsert({
    where: { key: 'OWNER' },
    update: {},
    create: { key: 'OWNER', name: 'Owner', isSystem: true },
  });
  const tenantRole = await prisma.role.upsert({
    where: { key: 'TENANT' },
    update: {},
    create: { key: 'TENANT', name: 'Tenant', isSystem: true },
  });

  await bindBundle(adminRole.id, Object.keys(PERMISSIONS), permissionIdByKey);
  await bindBundle(ownerRole.id, OWNER_BUNDLE, permissionIdByKey);
  await bindBundle(tenantRole.id, TENANT_BUNDLE, permissionIdByKey);

  console.log(
    `Seeded ${permissionRecords.length} permissions and 3 roles ` +
      `(ADMIN: ${Object.keys(PERMISSIONS).length}, OWNER: ${OWNER_BUNDLE.length}, TENANT: ${TENANT_BUNDLE.length}).`,
  );
}

async function bindBundle(roleId: string, keys: string[], permissionIdByKey: Map<string, string>) {
  for (const key of keys) {
    const permissionId = permissionIdByKey.get(key);
    if (!permissionId) throw new Error(`Unknown permission key in bundle: ${key}`);
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId } },
      update: {},
      create: { roleId, permissionId },
    });
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
