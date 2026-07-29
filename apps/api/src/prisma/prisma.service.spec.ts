import { ForbiddenException } from '@nestjs/common';
import { applyOwnerWhere, assertWritableOwner } from './prisma.service';

describe('applyOwnerWhere (multi-tenant read boundary)', () => {
  it('does not touch the where clause when scope is "all" (ADMIN)', () => {
    const args = { where: { status: 'VACANT' } };
    applyOwnerWhere('apartment', args, 'all');
    expect(args.where).toEqual({ status: 'VACANT' });
  });

  it('injects an ownerId filter for an owner-scoped model', () => {
    const args = { where: { status: 'VACANT' } };
    applyOwnerWhere('apartment', args, ['owner-1']);
    expect(args.where).toEqual({ status: 'VACANT', ownerId: { in: ['owner-1'] } });
  });

  it('scopes to nothing when the caller has zero allowed owners', () => {
    const args: { where?: Record<string, unknown> } = {};
    applyOwnerWhere('lease', args, []);
    expect(args.where).toEqual({ ownerId: { in: [] } });
  });

  it('leaves models with no ownerId column untouched even for a restricted caller', () => {
    const args = { where: { key: 'x' } };
    applyOwnerWhere('permission', args, ['owner-1']);
    expect(args.where).toEqual({ key: 'x' });
  });

  it('is case-insensitive on the Prisma-cased model name', () => {
    const args: { where?: Record<string, unknown> } = {};
    applyOwnerWhere('Apartment', args, ['owner-1']);
    expect(args.where).toEqual({ ownerId: { in: ['owner-1'] } });
  });
});

describe('assertWritableOwner (multi-tenant write boundary)', () => {
  it('allows any ownerId when scope is "all" (ADMIN)', () => {
    expect(() => assertWritableOwner('apartment', 'owner-9', 'all')).not.toThrow();
  });

  it('allows a write to an owner inside the caller scope', () => {
    expect(() => assertWritableOwner('apartment', 'owner-1', ['owner-1', 'owner-2'])).not.toThrow();
  });

  it('rejects a write to an owner outside the caller scope', () => {
    expect(() => assertWritableOwner('apartment', 'owner-9', ['owner-1'])).toThrow(ForbiddenException);
  });

  it('rejects a write with no ownerId at all for a scoped model', () => {
    expect(() => assertWritableOwner('apartment', undefined, ['owner-1'])).toThrow(ForbiddenException);
  });

  it('ignores models that carry no ownerId column', () => {
    expect(() => assertWritableOwner('permission', undefined, ['owner-1'])).not.toThrow();
  });
});
