import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';

export class ListUsersDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  roleKey?: string;
}
