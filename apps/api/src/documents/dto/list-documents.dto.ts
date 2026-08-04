import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';

export class ListDocumentsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  apartmentId?: string;

  @IsOptional()
  @IsString()
  leaseId?: string;

  @IsOptional()
  @IsString()
  category?: string;

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

  /** Owner-uploaded INVOICE documents not yet assigned to an apartment — powers the PM review queue. */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unassigned?: boolean;
}
