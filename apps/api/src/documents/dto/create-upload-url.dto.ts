import { IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { DocumentCategory } from '@pro-tenant/db';

export class CreateUploadUrlDto {
  @IsString()
  @MinLength(1)
  fileName!: string;

  @IsString()
  mimeType!: string;

  @IsInt()
  @Min(1)
  sizeBytes!: number;

  @IsEnum(DocumentCategory)
  category!: DocumentCategory;

  @IsOptional()
  @IsString()
  apartmentId?: string;

  @IsOptional()
  @IsString()
  leaseId?: string;

  @IsOptional()
  @IsString()
  maintenanceRequestId?: string;

  @IsOptional()
  @IsString()
  utilityRecordId?: string;

  @IsOptional()
  @IsString()
  apartmentInvoiceId?: string;

  @IsOptional()
  @IsString()
  paymentConfirmationId?: string;

  @IsOptional()
  @IsString()
  taskId?: string;

  /**
   * "YYYY-MM" — set only when an Owner uploads an INVOICE with no apartment
   * chosen yet (the bulk "upload this month's invoices" flow). Lets the PM's
   * review queue show which month a still-unassigned upload is for.
   */
  @IsOptional()
  @IsString()
  periodMonth?: string;
}
