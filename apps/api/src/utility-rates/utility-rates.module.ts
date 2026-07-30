import { Module } from '@nestjs/common';
import { UtilityRatesController } from './utility-rates.controller';
import { UtilityRatesService } from './utility-rates.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [UtilityRatesController],
  providers: [UtilityRatesService],
  exports: [UtilityRatesService],
})
export class UtilityRatesModule {}
