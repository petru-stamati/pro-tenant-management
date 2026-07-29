import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { UtilitiesService } from './utilities.service';
import { CreateUtilityRecordDto } from './dto/create-utility-record.dto';
import { UpdateUtilityRecordDto } from './dto/update-utility-record.dto';
import { ListUtilityRecordsDto } from './dto/list-utility-records.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';

@Controller('utility-records')
export class UtilitiesController {
  constructor(private readonly utilities: UtilitiesService) {}

  @Get()
  @RequirePermission('utilities:read')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListUtilityRecordsDto) {
    return this.utilities.list(user, query);
  }

  @Post()
  @RequirePermission('utilities:write')
  create(@Body() dto: CreateUtilityRecordDto, @CurrentUser() user: AuthenticatedUser) {
    return this.utilities.create(dto, user);
  }

  @Patch(':id')
  @RequirePermission('utilities:write')
  update(@Param('id') id: string, @Body() dto: UpdateUtilityRecordDto) {
    return this.utilities.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('utilities:write')
  remove(@Param('id') id: string) {
    return this.utilities.remove(id);
  }
}
