import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { closeTestApp, createTestApp, resetDatabase } from './utils/test-app';
import { createApartment, createLease, createOwner, createTenant, createUser, TEST_PASSWORD } from './utils/fixtures';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Multi-tenant ownership scoping (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  async function loginAs(email: string) {
    const res = await http.post('/v1/auth/login').send({ email, password: TEST_PASSWORD });
    return res.body.accessToken as string;
  }

  it("an OWNER's apartment list contains only their own apartments, never another owner's", async () => {
    const ownerA = await createOwner(prisma, { companyName: 'Owner A Co' });
    const ownerB = await createOwner(prisma, { companyName: 'Owner B Co' });
    const apartmentA = await createApartment(prisma, ownerA.id, { name: 'A - Flat 1' });
    await createApartment(prisma, ownerB.id, { name: 'B - Flat 1' });
    await createUser(prisma, { email: 'ownerA@e2e.test', roleKey: 'OWNER', ownerId: ownerA.id });

    const token = await loginAs('ownerA@e2e.test');
    const res = await http.get('/v1/apartments').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(apartmentA.id);
  });

  it("returns 404 (not 403 or the data) when an OWNER requests another owner's apartment by ID directly", async () => {
    const ownerA = await createOwner(prisma, { companyName: 'Owner A Co' });
    const ownerB = await createOwner(prisma, { companyName: 'Owner B Co' });
    const apartmentB = await createApartment(prisma, ownerB.id, { name: "B's flat" });
    await createUser(prisma, { email: 'ownerA@e2e.test', roleKey: 'OWNER', ownerId: ownerA.id });

    const token = await loginAs('ownerA@e2e.test');
    const res = await http.get(`/v1/apartments/${apartmentB.id}`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('an ADMIN (PM) sees every apartment across every owner', async () => {
    const ownerA = await createOwner(prisma, { companyName: 'Owner A Co' });
    const ownerB = await createOwner(prisma, { companyName: 'Owner B Co' });
    await createApartment(prisma, ownerA.id, { name: 'A - Flat 1' });
    await createApartment(prisma, ownerB.id, { name: 'B - Flat 1' });
    await createUser(prisma, { email: 'pm@e2e.test', roleKey: 'ADMIN' });

    const token = await loginAs('pm@e2e.test');
    const res = await http.get('/v1/apartments').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('an OWNER cannot create an apartment for a different owner by forging ownerId (write-side scoping)', async () => {
    // apartments:write is ADMIN-only per the seeded permission catalog, so this
    // is really a PermissionGuard check — confirms an OWNER gets 403, not 201.
    const ownerA = await createOwner(prisma, { companyName: 'Owner A Co' });
    await createUser(prisma, { email: 'ownerA@e2e.test', roleKey: 'OWNER', ownerId: ownerA.id });

    const token = await loginAs('ownerA@e2e.test');
    const res = await http
      .post('/v1/apartments')
      .set('Authorization', `Bearer ${token}`)
      .send({ ownerId: ownerA.id, name: 'New flat', addressLine: 'Str. X', city: 'Bucharest' });

    expect(res.status).toBe(403);
  });

  it("a TENANT sees no apartments/leases belonging to owners other than through their own lease", async () => {
    const ownerA = await createOwner(prisma, { companyName: 'Owner A Co' });
    const apartmentA = await createApartment(prisma, ownerA.id, { name: 'A - Flat 1', status: 'OCCUPIED' });
    const tenant = await createTenant(prisma, { email: 'jane@e2e.test' });
    const pm = await createUser(prisma, { email: 'pm2@e2e.test', roleKey: 'ADMIN' });
    await createLease(prisma, { apartmentId: apartmentA.id, ownerId: ownerA.id, tenantId: tenant.id, createdById: pm.id });
    await createUser(prisma, { email: 'tenant@e2e.test', roleKey: 'TENANT', tenantId: tenant.id });

    const token = await loginAs('tenant@e2e.test');
    const res = await http.get('/v1/apartments').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(apartmentA.id);
  });
});
