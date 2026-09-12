import { IsNumber, IsString, Min, MinLength } from 'class-validator';

export class LineItemDto {
  @IsString()
  @MinLength(1)
  description!: string;

  @IsNumber()
  @Min(0)
  priceEUR!: number;
}
