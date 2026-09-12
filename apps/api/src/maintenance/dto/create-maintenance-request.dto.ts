import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { LineItemDto } from './line-item.dto';

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

  /** Set when reported via the "report a problem" button on a specific inventory item. */
  @IsOptional()
  @IsString()
  roomItemId?: string;

  /**
   * Set when the PM already knows what's needed and is quoting it upfront
   * (repairs/cleaning after a move-out, etc.) — when present, the request
   * skips REPORTED/TRIAGED and goes straight to PENDING_OWNER_APPROVAL with
   * these as its first proposal (see MaintenanceService.create).
   */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineItemDto)
  lineItems?: LineItemDto[];
}
