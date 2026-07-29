import { IsDateString, IsNumber, Min } from 'class-validator';

export class RenewLeaseDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsNumber()
  @Min(0)
  rentAmountEUR!: number;
}
