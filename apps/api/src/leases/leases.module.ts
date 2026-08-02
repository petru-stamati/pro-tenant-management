import { Module } from '@nestjs/common';
import { LeasesController } from './leases.controller';
import { LeasesService } from './leases.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, NotificationsModule], // AuthModule for PermissionsService
  controllers: [LeasesController],
  providers: [LeasesService],
})
export class LeasesModule {}
