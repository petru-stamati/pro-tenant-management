import { Module } from '@nestjs/common';
import { ApartmentInvoicesController } from './apartment-invoices.controller';
import { ApartmentInvoicesService } from './apartment-invoices.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ApartmentInvoicesController],
  providers: [ApartmentInvoicesService],
  exports: [ApartmentInvoicesService],
})
export class ApartmentInvoicesModule {}
