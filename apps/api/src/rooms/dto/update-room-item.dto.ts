import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateRoomItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}
