import { Module } from '@nestjs/common';
import { PaymentConfirmationsController } from './payment-confirmations.controller';
import { PaymentConfirmationsService } from './payment-confirmations.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PaymentConfirmationsController],
  providers: [PaymentConfirmationsService],
  exports: [PaymentConfirmationsService],
})
export class PaymentConfirmationsModule {}
