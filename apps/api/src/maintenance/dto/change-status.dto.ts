import { IsEnum, IsOptional, IsString } from 'class-validator';
import { MaintenanceStatus } from '@pro-tenant/db';

export class ChangeStatusDto {
  @IsEnum(MaintenanceStatus)
  toStatus!: MaintenanceStatus;

  @IsOptional()
  @IsString()
  note?: string;
}
