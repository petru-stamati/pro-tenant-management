import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { CreateRoomItemDto } from './dto/create-room-item.dto';
import { UpdateRoomItemDto } from './dto/update-room-item.dto';
import { ListRoomsDto } from './dto/list-rooms.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  @RequirePermission('rooms:read')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListRoomsDto) {
    return this.rooms.list(user, query.apartmentId);
  }

  @Post()
  @RequirePermission('rooms:write')
  createRoom(@Body() dto: CreateRoomDto) {
    return this.rooms.createRoom(dto);
  }

  @Patch(':id')
  @RequirePermission('rooms:write')
  updateRoom(@Param('id') id: string, @Body() dto: UpdateRoomDto) {
    return this.rooms.updateRoom(id, dto);
  }

  @Delete(':id')
  @RequirePermission('rooms:write')
  removeRoom(@Param('id') id: string) {
    return this.rooms.removeRoom(id);
  }

  @Post(':id/items')
  @RequirePermission('rooms:write')
  createItem(@Param('id') roomId: string, @Body() dto: CreateRoomItemDto) {
    return this.rooms.createItem(roomId, dto);
  }
}

@Controller('room-items')
export class RoomItemsController {
  constructor(private readonly rooms: RoomsService) {}

  @Patch(':id')
  @RequirePermission('rooms:write')
  updateItem(@Param('id') id: string, @Body() dto: UpdateRoomItemDto) {
    return this.rooms.updateItem(id, dto);
  }

  @Delete(':id')
  @RequirePermission('rooms:write')
  removeItem(@Param('id') id: string) {
    return this.rooms.removeItem(id);
  }
}
