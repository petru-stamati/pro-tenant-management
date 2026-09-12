import { Logger, Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { StorageService } from './storage.service';
import { LocalStorageService } from './local-storage.service';
import { R2StorageService } from './r2-storage.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ApartmentInvoicesModule } from '../apartment-invoices/apartment-invoices.module';

const moduleLogger = new Logger('DocumentsModule');
const usingR2 = !!process.env.R2_ACCOUNT_ID;
moduleLogger.log(
  usingR2
    ? 'Document storage: R2StorageService (R2_ACCOUNT_ID is set)'
    : 'Document storage: LocalStorageService (R2_ACCOUNT_ID is NOT set — files will NOT persist across deploys/restarts)',
);

@Module({
  imports: [AuthModule, NotificationsModule, ApartmentInvoicesModule],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    {
      provide: StorageService,
      // R2 in any environment that has credentials for it (production);
      // local disk otherwise, so a dev machine without R2 creds still works.
      useClass: usingR2 ? R2StorageService : LocalStorageService,
    },
  ],
})
export class DocumentsModule {}
