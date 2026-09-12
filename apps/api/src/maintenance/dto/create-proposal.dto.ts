import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';
import { LineItemDto } from './line-item.dto';

/**
 * Either the original single-contractor shape (contractorName + costEUR +
 * description) or itemized lineItems that sum to costEUR — never both.
 * Enforced in MaintenanceService, same "exactly one mode" pattern as
 * CreatePaymentConfirmationDto's applications vs autoApplyAmountRON.
 */
export class CreateProposalDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  contractorName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costEUR?: number;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineItemDto)
  lineItems?: LineItemDto[];
}
