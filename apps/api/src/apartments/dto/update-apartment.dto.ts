import { IsOptional, IsString } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { CreateApartmentDto } from './create-apartment.dto';

export class UpdateApartmentDto extends PartialType(CreateApartmentDto) {
  /** Must be an existing PHOTO document belonging to this apartment — validated in ApartmentsService.update. */
  @IsOptional()
  @IsString()
  coverDocumentId?: string;
}
