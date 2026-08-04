import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../common/permissions.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { CreateRoomItemDto } from './dto/create-room-item.dto';
import { UpdateRoomItemDto } from './dto/update-room-item.dto';

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  async list(user: AuthenticatedUser, apartmentId: string) {
    const allowedOwnerIds = await this.permissions.resolveAllowedOwnerIds(user);
    const scoped = this.prisma.forOwnerScope(allowedOwnerIds);
    return scoped.room.findMany({
      where: { apartmentId },
      include: { items: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createRoom(dto: CreateRoomDto) {
    const apartment = await this.prisma.client.apartment.findFirst({ where: { id: dto.apartmentId } });
    if (!apartment) throw new BadRequestException('Apartment not found');

    const room = await this.prisma.client.room.create({
      data: {
        apartmentId: dto.apartmentId,
        ownerId: apartment.ownerId,
        type: dto.type,
        label: dto.label,
        notFurnished: dto.notFurnished ?? false,
      },
    });
    await this.recomputeFurnished(dto.apartmentId);
    return room;
  }

  async updateRoom(id: string, dto: UpdateRoomDto) {
    const room = await this.assertRoomExists(id);
    const updated = await this.prisma.client.room.update({
      where: { id },
      data: { type: dto.type, label: dto.label, notFurnished: dto.notFurnished },
    });
    if (dto.notFurnished !== undefined) await this.recomputeFurnished(room.apartmentId);
    return updated;
  }

  async removeRoom(id: string) {
    const room = await this.assertRoomExists(id);
    await this.prisma.client.roomItem.deleteMany({ where: { roomId: id } });
    await this.prisma.client.room.delete({ where: { id } });
    await this.recomputeFurnished(room.apartmentId);
    return { success: true };
  }

  async createItem(roomId: string, dto: CreateRoomItemDto) {
    await this.assertRoomExists(roomId);
    return this.prisma.client.roomItem.create({ data: { roomId, name: dto.name } });
  }

  async updateItem(id: string, dto: UpdateRoomItemDto) {
    await this.assertItemExists(id);
    return this.prisma.client.roomItem.update({ where: { id }, data: { name: dto.name } });
  }

  async removeItem(id: string) {
    await this.assertItemExists(id);
    await this.prisma.client.roomItem.delete({ where: { id } });
    return { success: true };
  }

  private async assertRoomExists(id: string) {
    const room = await this.prisma.client.room.findFirst({ where: { id } });
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  private async assertItemExists(id: string) {
    const item = await this.prisma.client.roomItem.findFirst({ where: { id } });
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  /**
   * Apartment.furnished is derived, not hand-set — FULLY_FURNISHED only when
   * every room is furnished, UNFURNISHED only when none are, else SEMI.
   * Skipped when the apartment has no rooms yet (nothing to derive from).
   */
  private async recomputeFurnished(apartmentId: string) {
    const rooms = await this.prisma.client.room.findMany({ where: { apartmentId } });
    if (rooms.length === 0) return;
    const furnishedCount = rooms.filter((r) => !r.notFurnished).length;
    const furnished =
      furnishedCount === rooms.length ? 'FULLY_FURNISHED' : furnishedCount === 0 ? 'UNFURNISHED' : 'SEMI_FURNISHED';
    await this.prisma.client.apartment.update({ where: { id: apartmentId }, data: { furnished } });
  }
}
