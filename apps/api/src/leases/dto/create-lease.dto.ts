import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { LeaseStatus } from '@pro-tenant/db';

export class CreateLeaseDto {
  @IsString()
  apartmentId!: string;

  @IsString()
  tenantId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsNumber()
  @Min(0)
  rentAmountEUR!: number;

  @IsNumber()
  @Min(0)
  depositAmountEUR!: number;

  @IsOptional()
  @IsEnum(LeaseStatus)
  status?: LeaseStatus;
}
