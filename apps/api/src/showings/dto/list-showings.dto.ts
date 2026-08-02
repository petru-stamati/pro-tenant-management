import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';

export class ListShowingsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  apartmentId?: string;
}
