import * as dotenv from 'dotenv';
import * as path from 'path';

// Loaded before any test file's imports run, so PrismaService (which reads
// process.env.DATABASE_URL in its constructor) always points at the
// dedicated pro_tenant_test database — never the real dev DB with this
// session's live PM/Owner/Tenant test accounts.
dotenv.config({ path: path.resolve(__dirname, '../.env.test'), quiet: true });

if (!process.env.DATABASE_URL?.includes('pro_tenant_test')) {
  throw new Error(
    'Refusing to run e2e tests: DATABASE_URL does not point at pro_tenant_test. ' +
      'Check apps/api/.env.test.',
  );
}
