import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RecordPaymentDto {
  @IsNumber()
  @Min(0)
  paidAmountEUR!: number;

  @IsOptional()
  @IsDateString()
  paidDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
