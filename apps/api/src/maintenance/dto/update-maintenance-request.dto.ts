import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateMaintenanceRequestDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  urgent?: boolean;
}
