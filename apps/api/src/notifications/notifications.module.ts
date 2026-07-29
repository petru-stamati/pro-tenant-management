import { Module } from '@nestjs/common';
import { NotificationsController, PushTokensController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController, PushTokensController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
