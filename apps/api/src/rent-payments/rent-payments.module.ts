import { Module } from '@nestjs/common';
import { RentPaymentsController } from './rent-payments.controller';
import { RentPaymentsService } from './rent-payments.service';
import { AuthModule } from '../auth/auth.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';

@Module({
  imports: [AuthModule, ExchangeRatesModule],
  controllers: [RentPaymentsController],
  providers: [RentPaymentsService],
})
export class RentPaymentsModule {}
