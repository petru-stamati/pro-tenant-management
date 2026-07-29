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
}
