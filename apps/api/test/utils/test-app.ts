import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Boots the real app (same global config as main.ts) against pro_tenant_test.
 * The IP-based rate limiter (incl. the 5-per-15-min login limiter) is
 * defused by stubbing its storage: every test in a suite shares one
 * process/one "IP", so a dozen tests hitting /auth/login would trip the
 * real limiter well before the suite finishes. Rate limiting itself isn't
 * what these tests verify — the account-lockout logic it's sometimes
 * confused with (AuditLog-based, per-account) is unaffected and still
 * fully exercised. (ThrottlerGuard is registered via `useClass` under the
 * multi-provider APP_GUARD token, which does NOT also expose ThrottlerGuard
 * as an independently overridable token — overrideGuard/overrideProvider on
 * the guard class itself silently no-ops. ThrottlerStorage is a normal,
 * singular DI token the guard depends on, so overriding that reliably
 * neuters it instead.)
 */
export async function createTestApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ThrottlerStorage)
    .useValue({
      increment: async () => ({ totalHits: 0, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 }),
    })
    .compile();
  const app = moduleRef.createNestApplication();

  app.setGlobalPrefix('v1');
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

/**
 * app.close() has been observed to hang indefinitely under Jest once the
 * app has done real Prisma/pg activity (never reproduced outside Jest) —
 * likely a driver-adapter/pg-pool teardown quirk. Don't let a stuck
 * teardown block the whole suite: give it a bounded window and move on:
 * the process exits via --forceExit regardless (see package.json test:e2e).
 */
export async function closeTestApp(app: INestApplication): Promise<void> {
  await Promise.race([app.close(), new Promise((resolve) => setTimeout(resolve, 5000))]);
}

/**
 * Tables that hold per-test fixture data. Role/Permission/RolePermission are
 * deliberately excluded — that's the shared seed catalog, not test data.
 * Order matters: children before the parents they reference.
 */
const RESETTABLE_TABLES = [
  '"AuditLog"',
  '"NotificationDelivery"',
  '"Notification"',
  '"MaintenanceComment"',
  '"MaintenanceProposal"',
  '"MaintenanceStatusEvent"',
  '"MaintenanceRequest"',
  '"Document"',
  '"UtilityRecord"',
  '"Invoice"',
  '"RentPayment"',
  '"Lease"',
  '"TenantInvite"',
  '"Tenant"',
  '"Apartment"',
  '"Note"',
  '"Owner"',
  '"PushDeviceToken"',
  '"RefreshToken"',
  '"UserPermission"',
  '"User"',
  '"ExchangeRate"',
];

/** Wipes all fixture data between e2e spec files so each one starts from a clean, known state. */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.client.$executeRawUnsafe(
    `TRUNCATE TABLE ${RESETTABLE_TABLES.join(', ')} RESTART IDENTITY CASCADE;`,
  );
}
