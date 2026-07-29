import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApartmentsService } from './apartments.service';
import { CreateApartmentDto } from './dto/create-apartment.dto';
import { UpdateApartmentDto } from './dto/update-apartment.dto';
import { ListApartmentsDto } from './dto/list-apartments.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';

@Controller('apartments')
export class ApartmentsController {
  constructor(private readonly apartments: ApartmentsService) {}

  @Get()
  @RequirePermission('apartments:read')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListApartmentsDto) {
    return this.apartments.list(user, query);
  }

  @Get(':id')
  @RequirePermission('apartments:read')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.apartments.findOne(user, id);
  }

  @Get(':id/tenant-history')
  @RequirePermission('apartments:read')
  tenantHistory(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.apartments.tenantHistory(user, id);
  }

  @Post()
  @RequirePermission('apartments:write')
  create(@Body() dto: CreateApartmentDto) {
    return this.apartments.create(dto);
  }

  @Patch(':id')
  @RequirePermission('apartments:write')
  update(@Param('id') id: string, @Body() dto: UpdateApartmentDto) {
    return this.apartments.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('apartments:write')
  remove(@Param('id') id: string) {
    return this.apartments.remove(id);
  }
}
