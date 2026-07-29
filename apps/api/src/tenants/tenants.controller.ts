import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { InviteTenantDto } from './dto/invite-tenant.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { PaginationQueryDto } from '../common/pagination';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get()
  @RequirePermission('tenants:read')
  list(@Query() query: PaginationQueryDto) {
    return this.tenants.list(query);
  }

  @Get(':id')
  @RequirePermission('tenants:read')
  findOne(@Param('id') id: string) {
    return this.tenants.findOne(id);
  }

  @Post()
  @RequirePermission('tenants:write')
  create(@Body() dto: CreateTenantDto) {
    return this.tenants.create(dto);
  }

  @Patch(':id')
  @RequirePermission('tenants:write')
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenants.update(id, dto);
  }

  @Post(':id/invite')
  @RequirePermission('tenants:write')
  invite(@Param('id') id: string, @Body() dto: InviteTenantDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tenants.invite(id, dto.leaseId, user);
  }
}

@Controller('tenant-invites')
export class TenantInvitesController {
  constructor(private readonly tenants: TenantsService) {}

  @Post(':id/resend')
  @RequirePermission('tenants:write')
  resend(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tenants.resendInvite(id, user);
  }

  @Delete(':id')
  @RequirePermission('tenants:write')
  revoke(@Param('id') id: string) {
    return this.tenants.revokeInvite(id);
  }
}
