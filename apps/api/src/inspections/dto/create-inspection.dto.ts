import { IsString } from 'class-validator';

export class CreateInspectionDto {
  @IsString()
  apartmentId!: string;
}
