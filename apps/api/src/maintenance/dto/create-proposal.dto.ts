import { IsNumber, IsString, Min, MinLength } from 'class-validator';

export class CreateProposalDto {
  @IsString()
  @MinLength(1)
  contractorName!: string;

  @IsNumber()
  @Min(0)
  costEUR!: number;

  @IsString()
  @MinLength(1)
  description!: string;
}
