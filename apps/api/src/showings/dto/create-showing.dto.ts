import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateShowingDto {
  @IsString()
  apartmentId!: string;

  @IsDateString()
  scheduledAt!: string;

  @IsString()
  @MinLength(1)
  prospectName!: string;

  @IsOptional()
  @IsString()
  prospectContact?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
