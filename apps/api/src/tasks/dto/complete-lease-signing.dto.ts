import { IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

/** Same lease-term fields CreateLeaseDto asks for — collected here instead, at the moment the signed contract comes back. */
export class CompleteLeaseSigningDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsNumber()
  @Min(0)
  rentAmountEUR!: number;

  @IsOptional()
  @IsBoolean()
  rentVatIncluded?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  termMonths?: number;

  @IsOptional()
  @IsBoolean()
  autoRenewal?: boolean;

  @IsNumber()
  @Min(0)
  depositAmountEUR!: number;
}
