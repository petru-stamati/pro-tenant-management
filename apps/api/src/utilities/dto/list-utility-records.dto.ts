import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';

export class ListUtilityRecordsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  apartmentId?: string;

  @IsOptional()
  @IsString()
  utilityType?: string;

  /** "YYYY-MM" — matches any record whose periodMonth falls in that calendar month. */
  @IsOptional()
  @IsString()
  month?: string;
}
