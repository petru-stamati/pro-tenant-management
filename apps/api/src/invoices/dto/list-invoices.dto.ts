import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';

export class ListInvoicesDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  apartmentId?: string;
}
