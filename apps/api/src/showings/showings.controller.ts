import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ShowingsService } from './showings.service';
import { CreateShowingDto } from './dto/create-showing.dto';
import { ListShowingsDto } from './dto/list-showings.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';

@Controller('showings')
export class ShowingsController {
  constructor(private readonly showings: ShowingsService) {}

  @Get()
  @RequirePermission('showings:read')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListShowingsDto) {
    return this.showings.list(user, query);
  }

  @Post()
  @RequirePermission('showings:write')
  create(@Body() dto: CreateShowingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.showings.create(dto, user);
  }

  @Delete(':id')
  @RequirePermission('showings:write')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.showings.remove(user, id);
  }
}
