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
 *
 * Two mutually exclusive modes (enforced in the service, not here, since
 * class-validator doesn't express "exactly one of" cleanly): either the
 * caller picks the invoices/amounts explicitly via `applications`, or hands
 * over one lump `autoApplyAmountRON` and lets the server walk this
 * apartment's outstanding invoices oldest-first — any leftover becomes a
 * standing credit on the apartment.
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

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PaymentApplicationInputDto)
  applications?: PaymentApplicationInputDto[];

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  autoApplyAmountRON?: number;
}
