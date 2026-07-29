import { IsDateString, IsEnum, IsNumber, IsOptional } from 'class-validator';
import { PaymentStatus } from '@pro-tenant/db';

export class UpdateUtilityRecordDto {
  @IsOptional()
  @IsNumber()
  previousReading?: number;

  @IsOptional()
  @IsNumber()
  currentReading?: number;

  @IsOptional()
  @IsNumber()
  invoiceAmountRON?: number;

  @IsOptional()
  @IsEnum(PaymentStatus)
  invoiceStatus?: PaymentStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;
}
