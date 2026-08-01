import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { SystemRoleKey, TaskStatus } from '@pro-tenant/db';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;

  @IsOptional()
  @IsBoolean()
  urgent?: boolean;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(SystemRoleKey)
  assignedToRole?: SystemRoleKey;
}
