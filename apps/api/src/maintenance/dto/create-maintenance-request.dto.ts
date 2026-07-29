import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateMaintenanceRequestDto {
  @IsString()
  apartmentId!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsOptional()
  @IsBoolean()
  urgent?: boolean;
}
