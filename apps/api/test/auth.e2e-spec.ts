import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { closeTestApp, createTestApp, resetDatabase } from './utils/test-app';
import { createUser, TEST_PASSWORD } from './utils/fixtures';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
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

  it('rejects login with a wrong password', async () => {
    await createUser(prisma, { email: 'pm@e2e.test', roleKey: 'ADMIN' });

    const res = await http.post('/v1/auth/login').send({ email: 'pm@e2e.test', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('rejects login for an unknown email', async () => {
    const res = await http.post('/v1/auth/login').send({ email: 'ghost@e2e.test', password: TEST_PASSWORD });
    expect(res.status).toBe(401);
  });

  it('logs in successfully and returns an access token plus a refresh cookie', async () => {
    await createUser(prisma, { email: 'pm@e2e.test', roleKey: 'ADMIN' });

    const res = await http.post('/v1/auth/login').send({ email: 'pm@e2e.test', password: TEST_PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user.email).toBe('pm@e2e.test');
    expect(res.body.user.passwordHash).toBeUndefined();
    const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
    expect(cookies?.some((c) => c.startsWith('refreshToken='))).toBe(true);
  });

  it('rejects a protected route with no Authorization header', async () => {
    const res = await http.get('/v1/apartments');
    expect(res.status).toBe(401);
  });

  it('rejects a protected route with a garbage bearer token', async () => {
    const res = await http.get('/v1/apartments').set('Authorization', 'Bearer not-a-real-jwt');
    expect(res.status).toBe(401);
  });

  it('accepts a protected route with a freshly-issued access token', async () => {
    await createUser(prisma, { email: 'pm@e2e.test', roleKey: 'ADMIN' });
    const login = await http.post('/v1/auth/login').send({ email: 'pm@e2e.test', password: TEST_PASSWORD });

    const res = await http.get('/v1/apartments').set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(200);
  });

  it('locks the account out after 5 failed attempts within the window, even with the right password on the 6th try', async () => {
    await createUser(prisma, { email: 'pm@e2e.test', roleKey: 'ADMIN' });

    for (let i = 0; i < 5; i++) {
      await http.post('/v1/auth/login').send({ email: 'pm@e2e.test', password: 'wrong' });
    }
    const res = await http.post('/v1/auth/login').send({ email: 'pm@e2e.test', password: TEST_PASSWORD });
    expect(res.status).toBe(403);
  });

  describe('refresh rotation + reuse detection', () => {
    it('rotates the refresh token and the old one no longer works', async () => {
      await createUser(prisma, { email: 'pm@e2e.test', roleKey: 'ADMIN' });
      const login = await http.post('/v1/auth/login').send({ email: 'pm@e2e.test', password: TEST_PASSWORD });
      const originalCookie = login.headers['set-cookie'];

      const refreshed = await http.post('/v1/auth/refresh').set('Cookie', originalCookie);
      expect(refreshed.status).toBe(201);
      // Not asserting accessToken !== login's — RS256 JWT signing is
      // deterministic given identical claims, and `iat` has only
      // second-precision, so back-to-back issuances can be byte-identical.
      // The refresh token itself (the value that actually rotates, backed
      // by fresh random bytes each time) is the property that matters:
      const newCookie = refreshed.headers['set-cookie'] as unknown as string[];
      expect(newCookie[0]).not.toBe((originalCookie as unknown as string[])[0]);

      // Reusing the original (now-rotated) refresh cookie must fail.
      const reuse = await http.post('/v1/auth/refresh').set('Cookie', originalCookie);
      expect(reuse.status).toBe(401);
    });

    it('treats refresh-token reuse as theft: the rotated (new, valid) token is also killed', async () => {
      await createUser(prisma, { email: 'pm@e2e.test', roleKey: 'ADMIN' });
      const login = await http.post('/v1/auth/login').send({ email: 'pm@e2e.test', password: TEST_PASSWORD });
      const originalCookie = login.headers['set-cookie'];

      const refreshed = await http.post('/v1/auth/refresh').set('Cookie', originalCookie);
      const newCookie = refreshed.headers['set-cookie'];

      // Trigger reuse detection on the old token...
      await http.post('/v1/auth/refresh').set('Cookie', originalCookie);

      // ...which must revoke the entire session, including the token issued by that very rotation.
      const afterTheft = await http.post('/v1/auth/refresh').set('Cookie', newCookie);
      expect(afterTheft.status).toBe(401);
    });

    it('logout revokes the refresh token so it can no longer be used', async () => {
      await createUser(prisma, { email: 'pm@e2e.test', roleKey: 'ADMIN' });
      const login = await http.post('/v1/auth/login').send({ email: 'pm@e2e.test', password: TEST_PASSWORD });
      const cookie = login.headers['set-cookie'];

      // logout is NOT @Public() — it requires a valid access token in
      // addition to the refresh cookie, not the cookie alone.
      const logoutRes = await http
        .post('/v1/auth/logout')
        .set('Cookie', cookie)
        .set('Authorization', `Bearer ${login.body.accessToken}`);
      expect(logoutRes.status).toBe(201);

      const afterLogout = await http.post('/v1/auth/refresh').set('Cookie', cookie);
      expect(afterLogout.status).toBe(401);
    });
  });

  it('a disabled account cannot log in even with the correct password', async () => {
    await createUser(prisma, { email: 'disabled@e2e.test', roleKey: 'ADMIN', status: 'DISABLED' });
    const res = await http.post('/v1/auth/login').send({ email: 'disabled@e2e.test', password: TEST_PASSWORD });
    expect(res.status).toBe(401);
  });
});
