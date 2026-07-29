import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AccountStatus } from '@pro-tenant/db';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;
}
