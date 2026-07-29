import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { UtilityType } from '@pro-tenant/db';

export class CreateUtilityRecordDto {
  @IsString()
  apartmentId!: string;

  @IsOptional()
  @IsString()
  leaseId?: string;

  @IsEnum(UtilityType)
  utilityType!: UtilityType;

  @IsDateString()
  periodMonth!: string;

  @IsOptional()
  @IsNumber()
  previousReading?: number;

  @IsOptional()
  @IsNumber()
  currentReading?: number;

  @IsNumber()
  @Min(0)
  invoiceAmountRON!: number;
}
