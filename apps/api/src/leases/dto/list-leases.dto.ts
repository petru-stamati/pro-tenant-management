import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';

export class ListLeasesDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  apartmentId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
