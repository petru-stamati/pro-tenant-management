import { Module } from '@nestjs/common';
import { UtilitiesController } from './utilities.controller';
import { UtilitiesService } from './utilities.service';
import { AuthModule } from '../auth/auth.module';
import { UtilityRatesModule } from '../utility-rates/utility-rates.module';

@Module({
  imports: [AuthModule, UtilityRatesModule],
  controllers: [UtilitiesController],
  providers: [UtilitiesService],
})
export class UtilitiesModule {}
