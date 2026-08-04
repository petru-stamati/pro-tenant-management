import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { RoomType } from '@pro-tenant/db';

export class CreateRoomDto {
  @IsString()
  apartmentId!: string;

  @IsEnum(RoomType)
  type!: RoomType;

  @IsString()
  @MinLength(1)
  label!: string;

  @IsOptional()
  @IsBoolean()
  notFurnished?: boolean;
}
