import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';

export class ListPaymentConfirmationsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  apartmentId?: string;
}
