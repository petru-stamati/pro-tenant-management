import { Module } from '@nestjs/common';
import { ApartmentsController } from './apartments.controller';
import { ApartmentsService } from './apartments.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule], // for PermissionsService
  controllers: [ApartmentsController],
  providers: [ApartmentsService],
})
export class ApartmentsModule {}
