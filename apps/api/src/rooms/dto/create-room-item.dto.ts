import { IsString, MinLength } from 'class-validator';

export class CreateRoomItemDto {
  @IsString()
  @MinLength(1)
  name!: string;
}
