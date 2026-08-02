import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { LeasesService } from './leases.service';
import { CreateLeaseDto } from './dto/create-lease.dto';
import { UpdateLeaseDto } from './dto/update-lease.dto';
import { RenewLeaseDto } from './dto/renew-lease.dto';
import { TerminateLeaseDto } from './dto/terminate-lease.dto';
import { ListLeasesDto } from './dto/list-leases.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';

@Controller('leases')
export class LeasesController {
  constructor(private readonly leases: LeasesService) {}

  @Get()
  @RequirePermission('leases:read')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListLeasesDto) {
    return this.leases.list(user, query);
  }

  @Get(':id')
  @RequirePermission('leases:read')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.leases.findOne(user, id);
  }

  @Post()
  @RequirePermission('leases:write')
  create(@Body() dto: CreateLeaseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.leases.create(dto, user);
  }

  @Patch(':id')
  @RequirePermission('leases:write')
  update(@Param('id') id: string, @Body() dto: UpdateLeaseDto) {
    return this.leases.update(id, dto);
  }

  @Post(':id/renew')
  @RequirePermission('leases:write')
  renew(@Param('id') id: string, @Body() dto: RenewLeaseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.leases.renew(id, dto, user);
  }

  @Post(':id/terminate')
  @RequirePermission('leases:write')
  terminate(@Param('id') id: string, @Body() dto: TerminateLeaseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.leases.terminate(id, dto.reason, user);
  }
}
