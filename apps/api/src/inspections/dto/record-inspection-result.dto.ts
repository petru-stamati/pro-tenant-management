import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { InspectionOutcome } from '@pro-tenant/db';

export class RecordInspectionResultDto {
  @IsString()
  roomItemId!: string;

  @IsEnum(InspectionOutcome)
  outcome!: InspectionOutcome;

  /** Reason — required in spirit for NEEDS_ATTENTION/REMOVED, not enforced here (service handles it). */
  @IsOptional()
  @IsString()
  note?: string;

  /** Required when outcome is REPLACED — the new item's description. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  newName?: string;
}
