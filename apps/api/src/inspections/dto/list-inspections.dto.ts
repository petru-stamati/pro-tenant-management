import { IsString } from 'class-validator';

export class ListInspectionsDto {
  @IsString()
  apartmentId!: string;
}
