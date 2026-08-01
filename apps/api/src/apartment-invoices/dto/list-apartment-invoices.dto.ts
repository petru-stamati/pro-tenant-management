import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';

export class ListApartmentInvoicesDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  apartmentId?: string;

  /** "YYYY-MM" — matches any invoice whose periodMonth falls in that calendar month. */
  @IsOptional()
  @IsString()
  month?: string;
}
