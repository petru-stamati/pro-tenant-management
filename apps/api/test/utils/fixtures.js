"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEST_PASSWORD = void 0;
exports.createOwner = createOwner;
exports.createApartment = createApartment;
exports.createTenant = createTenant;
exports.createUser = createUser;
exports.createLease = createLease;
const argon2 = __importStar(require("argon2"));
exports.TEST_PASSWORD = 'TestPassword123!';
let passwordHashCache;
async function testPasswordHash() {
    passwordHashCache ??= await argon2.hash(exports.TEST_PASSWORD, { type: argon2.argon2id });
    return passwordHashCache;
}
async function createOwner(prisma, overrides = {}) {
    return prisma.client.owner.create({
        data: {
            companyName: overrides.companyName ?? `Test Owner ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            contactName: 'Test Contact',
            email: `owner-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`,
        },
    });
}
async function createApartment(prisma, ownerId, overrides = {}) {
    return prisma.client.apartment.create({
        data: {
            ownerId,
            name: overrides.name ?? `Test Apartment ${Date.now()}`,
            addressLine: 'Str. Test 1',
            city: 'Bucharest',
            status: overrides.status ?? 'VACANT',
        },
    });
}
async function createTenant(prisma, overrides = {}) {
    return prisma.client.tenant.create({
        data: {
            firstName: overrides.firstName ?? 'Test',
            lastName: overrides.lastName ?? 'Tenant',
            email: overrides.email ?? `tenant-${Date.now()}@example.test`,
        },
    });
}
async function createUser(prisma, options) {
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
async function createLease(prisma, params) {
    return prisma.client.lease.create({
        data: {
            apartmentId: params.apartmentId,
            ownerId: params.ownerId,
            tenantId: params.tenantId,
            startDate: new Date('2026-01-01'),
            endDate: new Date('2027-01-01'),
            rentAmountEUR: params.rentAmountEUR ?? 500,
            depositAmountEUR: params.rentAmountEUR ?? 500,
            status: params.status ?? 'ACTIVE',
            createdById: params.createdById,
        },
    });
}
//# sourceMappingURL=fixtures.js.map