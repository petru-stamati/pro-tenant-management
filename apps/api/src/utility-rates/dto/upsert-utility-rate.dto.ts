import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { UtilityType } from '@pro-tenant/db';

export class UpsertUtilityRateDto {
  @IsString()
  ownerId!: string;

  @IsEnum(UtilityType)
  utilityType!: UtilityType;

  @IsNumber()
  @Min(0)
  pricePerUnit!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  conversionFactor?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  vatPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maintenanceFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maintenanceVatPercent?: number;
}
