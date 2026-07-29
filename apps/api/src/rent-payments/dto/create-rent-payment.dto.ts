import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateRentPaymentDto {
  @IsString()
  leaseId!: string;

  @IsDateString()
  dueDate!: string;

  @IsNumber()
  @Min(0)
  rentAmountEUR!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
