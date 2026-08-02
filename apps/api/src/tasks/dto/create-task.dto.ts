import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { SystemRoleKey, TaskKind } from '@pro-tenant/db';

export class CreateTaskDto {
  /** Required when the caller is PM/Admin (who manages multiple owners) — ignored and forced to the caller's own owner when an Owner creates the task. */
  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsString()
  apartmentId?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsOptional()
  @IsBoolean()
  urgent?: boolean;

  /** Whose turn it is to act. Ignored (always ADMIN) when an Owner creates the task — they can only delegate to the PM. */
  @IsOptional()
  @IsEnum(SystemRoleKey)
  assignedToRole?: SystemRoleKey;

  /** LEASE_SIGNING requires apartmentId + tenantId (validated in the service — the apartment must be vacant). */
  @IsOptional()
  @IsEnum(TaskKind)
  kind?: TaskKind;
}
