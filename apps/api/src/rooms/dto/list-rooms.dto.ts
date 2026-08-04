import { IsString } from 'class-validator';

export class ListRoomsDto {
  @IsString()
  apartmentId!: string;
}
