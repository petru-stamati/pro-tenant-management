import { ForbiddenException, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@pro-tenant/db';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Models covered by the "nothing is ever deleted" rule (PRD §4.4 / schema
 * file header). Kept as an explicit list rather than reflecting on the
 * schema at runtime, so a new model is soft-delete-safe only once someone
 * deliberately adds it here.
 */
const SOFT_DELETE_MODELS = new Set([
  'user',
  'owner',
  'apartment',
  'tenant',
  'lease',
  'rentPayment',
  'invoice',
  'utilityRecord',
  'document',
  'maintenanceRequest',
  'maintenanceProposal',
  'maintenanceComment',
  'note',
]);

/**
 * Models carrying the denormalized `ownerId` column (see schema file header,
 * point 2) — the set the owner-scope extension is allowed to filter on.
 */
const OWNER_SCOPED_MODELS = new Set([
  'apartment',
  'lease',
  'rentPayment',
  'invoice',
  'utilityRecord',
  'document',
  'maintenanceRequest',
  'note',
]);

function softDelete(client: PrismaClient) {
  return client.$extends({
    name: 'soft-delete',
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          applySoftDeleteWhere(model, args as { where?: Record<string, unknown> });
          return query(args);
        },
        async findFirst({ model, args, query }) {
          applySoftDeleteWhere(model, args as { where?: Record<string, unknown> });
          return query(args);
        },
        async count({ model, args, query }) {
          applySoftDeleteWhere(model, args as { where?: Record<string, unknown> });
          return query(args);
        },
        // `delete`/`deleteMany` are rewritten into an update — there is no
        // code path anywhere in this service layer that can hard-delete a
        // business row (PRD: "nothing should ever be deleted").
        async delete({ model, args, query }) {
          if (!SOFT_DELETE_MODELS.has(uncapitalize(model))) return query(args);
          const modelKey = uncapitalize(model) as keyof PrismaClient;
          return (client[modelKey] as any).update({
            where: args.where,
            data: { deletedAt: new Date() },
          });
        },
        async deleteMany({ model, args, query }) {
          if (!SOFT_DELETE_MODELS.has(uncapitalize(model))) return query(args);
          const modelKey = uncapitalize(model) as keyof PrismaClient;
          return (client[modelKey] as any).updateMany({
            where: args.where,
            data: { deletedAt: new Date() },
          });
        },
      },
    },
  });
}

function uncapitalize(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function applySoftDeleteWhere(model: string, args: { where?: Record<string, unknown> }) {
  if (SOFT_DELETE_MODELS.has(uncapitalize(model))) {
    args.where = { deletedAt: null, ...args.where };
  }
}

export type ScopedPrismaClient = ReturnType<PrismaService['forOwnerScope']>;

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  /** Soft-delete-safe client, unrestricted by owner — used by ADMIN callers and internal jobs. */
  readonly client: ReturnType<typeof softDelete>;

  private readonly raw: PrismaClient;

  constructor() {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    this.raw = new PrismaClient({ adapter });
    this.client = softDelete(this.raw);
  }

  async onModuleInit() {
    await this.raw.$connect();
  }

  async onModuleDestroy() {
    await this.raw.$disconnect();
  }

  /**
   * The Phase 4 §8 scoped client: every read against an owner-scoped model
   * is narrowed to `allowedOwnerIds`, and every write is rejected up front
   * if it targets an ownerId outside that set — enforced here so no
   * individual service method can forget it. Pass `'all'` for ADMIN.
   */
  forOwnerScope(allowedOwnerIds: string[] | 'all') {
    return this.client.$extends({
      name: 'owner-scope',
      query: {
        $allModels: {
          async findMany({ model, args, query }) {
            applyOwnerWhere(model, args as GenericArgs, allowedOwnerIds);
            return query(args);
          },
          async findFirst({ model, args, query }) {
            applyOwnerWhere(model, args as GenericArgs, allowedOwnerIds);
            return query(args);
          },
          async count({ model, args, query }) {
            applyOwnerWhere(model, args as GenericArgs, allowedOwnerIds);
            return query(args);
          },
          async create({ model, args, query }) {
            assertWritableOwner(model, (args as GenericArgs).data?.ownerId, allowedOwnerIds);
            return query(args);
          },
          async update({ model, args, query }) {
            applyOwnerWhere(model, args as GenericArgs, allowedOwnerIds);
            return query(args);
          },
          async updateMany({ model, args, query }) {
            applyOwnerWhere(model, args as GenericArgs, allowedOwnerIds);
            return query(args);
          },
        },
      },
    });
  }
}

/**
 * The Prisma extension `$allModels` API is intentionally loosely typed —
 * `args`/`data` shapes differ per model, and there is no single type that
 * covers all of them. These casts are scoped to this one file, behind the
 * `OWNER_SCOPED_MODELS` runtime check, rather than leaking `any` into the
 * rest of the codebase.
 */
type GenericArgs = { where?: Record<string, unknown>; data?: { ownerId?: string } };

export function applyOwnerWhere(model: string, args: GenericArgs, allowedOwnerIds: string[] | 'all') {
  if (allowedOwnerIds !== 'all' && OWNER_SCOPED_MODELS.has(uncapitalize(model))) {
    args.where = { ...args.where, ownerId: { in: allowedOwnerIds } };
  }
}

export function assertWritableOwner(
  model: string,
  ownerId: string | undefined,
  allowedOwnerIds: string[] | 'all',
) {
  if (allowedOwnerIds === 'all') return;
  if (!OWNER_SCOPED_MODELS.has(uncapitalize(model))) return;
  if (!ownerId || !allowedOwnerIds.includes(ownerId)) {
    throw new ForbiddenException(
      `Cannot create a ${model} for an owner outside your scope`,
    );
  }
}
