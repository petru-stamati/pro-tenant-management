import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { ApartmentInvoiceType } from '@pro-tenant/db';

export class AssignInvoiceDto {
  @IsString()
  apartmentId!: string;

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

  @IsDateString()
  periodMonth!: string;

  @IsNumber()
  @Min(0)
  totalAmountRON!: number;
}
