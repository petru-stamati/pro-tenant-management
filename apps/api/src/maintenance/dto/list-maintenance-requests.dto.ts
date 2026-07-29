import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';

export class ListMaintenanceRequestsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  apartmentId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
