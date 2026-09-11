import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { StorageService } from './storage.service';
import { LocalStorageService } from './local-storage.service';
import { R2StorageService } from './r2-storage.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ApartmentInvoicesModule } from '../apartment-invoices/apartment-invoices.module';

@Module({
  imports: [AuthModule, NotificationsModule, ApartmentInvoicesModule],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    {
      provide: StorageService,
      // R2 in any environment that has credentials for it (production);
      // local disk otherwise, so a dev machine without R2 creds still works.
      useClass: process.env.R2_ACCOUNT_ID ? R2StorageService : LocalStorageService,
    },
  ],
})
export class DocumentsModule {}
