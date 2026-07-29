import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class LeaseExpirationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  withinDays: number = 90;

  @IsOptional()
  @IsString()
  ownerId?: string;
}
