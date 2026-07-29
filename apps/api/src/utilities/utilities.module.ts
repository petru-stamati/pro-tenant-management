import { Module } from '@nestjs/common';
import { UtilitiesController } from './utilities.controller';
import { UtilitiesService } from './utilities.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [UtilitiesController],
  providers: [UtilitiesService],
})
export class UtilitiesModule {}
