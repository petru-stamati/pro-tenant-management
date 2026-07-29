"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTestApp = createTestApp;
exports.closeTestApp = closeTestApp;
exports.resetDatabase = resetDatabase;
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const testing_1 = require("@nestjs/testing");
const throttler_1 = require("@nestjs/throttler");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const app_module_1 = require("../../src/app.module");
const http_exception_filter_1 = require("../../src/common/filters/http-exception.filter");
const prisma_service_1 = require("../../src/prisma/prisma.service");
async function createTestApp() {
    const moduleRef = await testing_1.Test.createTestingModule({ imports: [app_module_1.AppModule] })
        .overrideProvider(throttler_1.ThrottlerStorage)
        .useValue({
        increment: async () => ({ totalHits: 0, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 }),
    })
        .compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.use((0, cookie_parser_1.default)());
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
    await app.init();
    return { app, prisma: app.get(prisma_service_1.PrismaService) };
}
async function closeTestApp(app) {
    await Promise.race([app.close(), new Promise((resolve) => setTimeout(resolve, 5000))]);
}
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
async function resetDatabase(prisma) {
    await prisma.client.$executeRawUnsafe(`TRUNCATE TABLE ${RESETTABLE_TABLES.join(', ')} RESTART IDENTITY CASCADE;`);
}
//# sourceMappingURL=test-app.js.map