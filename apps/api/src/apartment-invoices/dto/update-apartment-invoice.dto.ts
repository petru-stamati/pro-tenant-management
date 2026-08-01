import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { ApartmentInvoiceType } from '@pro-tenant/db';

/** Lets the uploader correct auto-extracted (or manually mistyped) fields after the fact. */
export class UpdateApartmentInvoiceDto {
  @IsOptional()
  @IsEnum(ApartmentInvoiceType)
  type?: ApartmentInvoiceType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  invoiceNumber?: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsDateString()
  periodMonth?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmountRON?: number;
}
