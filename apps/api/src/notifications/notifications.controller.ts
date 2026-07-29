import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListNotificationsDto) {
    return this.notifications.list(user.id, query);
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notifications.markRead(user.id, id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user.id);
  }
}

@Controller('push-tokens')
export class PushTokensController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post()
  register(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterPushTokenDto) {
    return this.notifications.registerPushToken(user.id, dto);
  }

  @Delete(':token')
  unregister(@Param('token') token: string) {
    return this.notifications.unregisterPushToken(token);
  }
}
