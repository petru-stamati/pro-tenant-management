import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { LocalStorageService } from './local-storage.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ApartmentInvoicesModule } from '../apartment-invoices/apartment-invoices.module';

@Module({
  imports: [AuthModule, NotificationsModule, ApartmentInvoicesModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, LocalStorageService],
})
export class DocumentsModule {}
