import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { OwnersService } from './owners.service';
import { CreateOwnerDto } from './dto/create-owner.dto';
import { UpdateOwnerDto } from './dto/update-owner.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { PaginationQueryDto } from '../common/pagination';

@Controller('owners')
export class OwnersController {
  constructor(private readonly owners: OwnersService) {}

  @Get()
  @RequirePermission('owners:read')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    return this.owners.list(user, query);
  }

  @Get(':id')
  @RequirePermission('owners:read')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.owners.findOne(user, id);
  }

  @Post()
  @RequirePermission('owners:write')
  create(@Body() dto: CreateOwnerDto) {
    return this.owners.create(dto);
  }

  @Patch(':id')
  @RequirePermission('owners:write')
  update(@Param('id') id: string, @Body() dto: UpdateOwnerDto) {
    return this.owners.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('owners:write')
  remove(@Param('id') id: string) {
    return this.owners.remove(id);
  }
}
