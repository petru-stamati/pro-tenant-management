import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
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

  /** Whether `rentAmountEUR` already has VAT folded in. Defaults to true — every price in the app is VAT-incl. unless toggled off. */
  @IsOptional()
  @IsBoolean()
  rentVatIncluded?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  termMonths?: number;

  @IsNumber()
  @Min(0)
  depositAmountEUR!: number;

  @IsOptional()
  @IsEnum(LeaseStatus)
  status?: LeaseStatus;
}
