# @pro-tenant/db

Prisma schema for PRO Tenant Management — the single source of truth for the Postgres database, imported only by `apps/api`.

## Setup (once Node.js + PostgreSQL are available)

```bash
cp .env.example .env   # point DATABASE_URL at your local Postgres
npm install
npm run migrate:dev    # creates the DB schema + generates the client
```

## Notable modeling decisions (Phase 2)

- **Nothing is hard-deleted.** Every business table has `deletedAt`; a Prisma Client extension (added in Phase 5) filters it automatically so no query can forget. Pure log tables (`AuditLog`, `MaintenanceStatusEvent`, `ExchangeRate`, `NotificationDelivery`) have no `deletedAt` — they're append-only by nature.
- **`ownerId` is denormalized** onto every apartment-scoped child table (`Lease`, `RentPayment`, `UtilityRecord`, `Document`, `MaintenanceRequest`, `Note`, `Invoice`) instead of being derived through a join every time. This is what makes row-level Owner scoping a single indexed `WHERE ownerId = ?` in the service layer, per the PRD's explicit security requirement.
- **Nothing is overwritten — new rows instead of edits**, for every "versioned" concept in the PRD: lease renewals (`Lease.renewedFromLeaseId`), document versions (`Document.previousVersionId`), and repair quotes (`MaintenanceProposal.version`, old one flipped to `SUPERSEDED`).
- **Currency**: `Apartment`/`Lease` never store a RON amount. `Invoice` is the only place a RON figure exists, and it snapshots `exchangeRateRON` + `invoiceDate` permanently at generation time (PRD §7) — the daily rate itself lives in `ExchangeRate`, fetched by a Phase 5 background job.
- **RBAC**: `Role` → `RolePermission` is the default bundle (Admin/Owner ship pre-seeded); `UserPermission` layers individual grants on top, optionally scoped to one `ownerId` — the mechanism for a future Employee limited to one client's buildings without any code change.
- **Full-text search** (PRD §4.11): no `tsvector` column is modeled in Prisma (it has no native type for it). A follow-up raw-SQL migration adds a generated `search_vector` column + GIN index on `Document` (and similarly on `Apartment`/`Owner`/`Tenant`) once migrations are running.

## Deliberately deferred to later phases

- Actual migrations (`prisma migrate dev`) — needs a running Postgres instance and Node.js, neither of which are set up on this machine yet.
- The soft-delete Prisma Client extension, permission guard, and audit interceptor — Phase 5 (Backend).
- Seed script for the two existing clients (RES NON VERBA SRL / Ashton Topolinski, Michael Topolinski Consulting SRL / Michael Topolinski) and their 21 apartments — can be added alongside Phase 5.
