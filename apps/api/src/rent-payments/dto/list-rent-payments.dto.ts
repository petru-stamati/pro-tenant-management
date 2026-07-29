import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';

export class ListRentPaymentsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  apartmentId?: string;

  @IsOptional()
  @IsString()
  leaseId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
