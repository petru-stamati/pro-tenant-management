import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermission('users:read')
  list(@Query() query: ListUsersDto) {
    return this.users.list(query);
  }

  @Post()
  @RequirePermission('users:write')
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id')
  @RequirePermission('users:write')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Patch(':id/permissions')
  @RequirePermission('users:manage-permissions')
  updatePermissions(@Param('id') id: string, @Body() dto: UpdatePermissionsDto) {
    return this.users.updatePermissions(id, dto);
  }
}

@Controller()
export class RolesPermissionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('roles')
  @RequirePermission('users:read')
  roles() {
    return this.prisma.client.role.findMany({ orderBy: { name: 'asc' } });
  }

  @Get('permissions')
  @RequirePermission('users:read')
  permissions() {
    return this.prisma.client.permission.findMany({ orderBy: { key: 'asc' } });
  }
}
