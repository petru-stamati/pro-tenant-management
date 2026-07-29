import { IsDateString, IsNumber, Min } from 'class-validator';

export class RecordExchangeRateDto {
  @IsDateString()
  date!: string;

  @IsNumber()
  @Min(0)
  rateRON!: number;
}
