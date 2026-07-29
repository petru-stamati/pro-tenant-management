import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { LocalStorageService } from './local-storage.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, LocalStorageService],
})
export class DocumentsModule {}
