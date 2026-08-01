import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { ApartmentInvoiceType } from '@pro-tenant/db';

export class CreateApartmentInvoiceDto {
  @IsString()
  apartmentId!: string;

  @IsOptional()
  @IsString()
  leaseId?: string;

  @IsEnum(ApartmentInvoiceType)
  type!: ApartmentInvoiceType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  invoiceNumber?: string;

  @IsDateString()
  issueDate!: string;

  @IsDateString()
  dueDate!: string;

  /** "YYYY-MM-DD" (first of month) or any date within the target month — normalized server-side. */
  @IsDateString()
  periodMonth!: string;

  @IsNumber()
  @Min(0)
  totalAmountRON!: number;

  @IsOptional()
  @IsBoolean()
  autoExtracted?: boolean;
}
