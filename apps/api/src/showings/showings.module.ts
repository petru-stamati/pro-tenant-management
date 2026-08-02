import { Module } from '@nestjs/common';
import { ShowingsController } from './showings.controller';
import { ShowingsService } from './showings.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ShowingsController],
  providers: [ShowingsService],
})
export class ShowingsModule {}
