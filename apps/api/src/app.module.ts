import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { OwnersModule } from './owners/owners.module';
import { ApartmentsModule } from './apartments/apartments.module';
import { TenantsModule } from './tenants/tenants.module';
import { LeasesModule } from './leases/leases.module';
import { ExchangeRatesModule } from './exchange-rates/exchange-rates.module';
import { RentPaymentsModule } from './rent-payments/rent-payments.module';
import { InvoicesModule } from './invoices/invoices.module';
import { ApartmentInvoicesModule } from './apartment-invoices/apartment-invoices.module';
import { PaymentConfirmationsModule } from './payment-confirmations/payment-confirmations.module';
import { UtilitiesModule } from './utilities/utilities.module';
import { UtilityRatesModule } from './utility-rates/utility-rates.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { TasksModule } from './tasks/tasks.module';
import { ShowingsModule } from './showings/showings.module';
import { RoomsModule } from './rooms/rooms.module';
import { InspectionsModule } from './inspections/inspections.module';
import { NotesModule } from './notes/notes.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { UsersModule } from './users/users.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { DocumentsModule } from './documents/documents.module';
import { SearchModule } from './search/search.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ScheduleModule.forRoot(),
    // Generous API-wide default; /auth/login overrides this with the strict
    // 5-per-15-min limit from Phase 4 §4 via @Throttle on that one handler.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    OwnersModule,
    ApartmentsModule,
    TenantsModule,
    LeasesModule,
    ExchangeRatesModule,
    RentPaymentsModule,
    InvoicesModule,
    ApartmentInvoicesModule,
    PaymentConfirmationsModule,
    UtilitiesModule,
    UtilityRatesModule,
    MaintenanceModule,
    TasksModule,
    ShowingsModule,
    RoomsModule,
    InspectionsModule,
    NotesModule,
    AnalyticsModule,
    NotificationsModule,
    UsersModule,
    AuditLogModule,
    DocumentsModule,
    SearchModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
