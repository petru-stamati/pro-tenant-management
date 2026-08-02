import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '@pro-tenant/db';

export class PaymentApplicationInputDto {
  @IsString()
  invoiceId!: string;

  /** Ignored (invoice's remaining outstanding is used instead) when paidInFull is true. */
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amountRON?: number;

  @IsOptional()
  @IsBoolean()
  paidInFull?: boolean;
}

/**
 * A single uploaded/logged payment, split across one or more invoices —
 * covers everything from "one invoice paid in full" to "1300 RON covering
 * last month's leftover balance, this month's rent in full, and part of
 * this month's utilities" (see Payments page spec).
 */
export class CreatePaymentConfirmationDto {
  @IsString()
  apartmentId!: string;

  @IsDateString()
  paymentDate!: string;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @IsString()
  @MinLength(1)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PaymentApplicationInputDto)
  applications!: PaymentApplicationInputDto[];
}
