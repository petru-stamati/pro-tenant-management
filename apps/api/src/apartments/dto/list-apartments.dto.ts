import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApartmentStatus } from '@pro-tenant/db';
import { PaginationQueryDto } from '../../common/pagination';

export class ListApartmentsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsEnum(ApartmentStatus)
  status?: ApartmentStatus;
}
