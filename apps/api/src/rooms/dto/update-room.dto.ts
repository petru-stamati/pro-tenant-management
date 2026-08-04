import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { RoomType } from '@pro-tenant/db';

export class UpdateRoomDto {
  @IsOptional()
  @IsEnum(RoomType)
  type?: RoomType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  label?: string;

  @IsOptional()
  @IsBoolean()
  notFurnished?: boolean;
}
