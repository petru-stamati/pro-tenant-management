import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';

export class ListApartmentInvoicesDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  apartmentId?: string;

  /** "YYYY-MM" — matches any invoice whose periodMonth falls in that calendar month. */
  @IsOptional()
  @IsString()
  month?: string;

  /** All-time (ignores `month`), status UNPAID or PARTIALLY_PAID only — powers the Outstanding KPI drill-down. */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  outstandingOnly?: boolean;
}
