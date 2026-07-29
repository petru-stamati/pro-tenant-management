import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** The list envelope from Phase 3 §1 — every list endpoint returns this shape. */
export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @IsOptional()
  @IsString()
  search?: string;
}

export function paginate<T>(data: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return {
    data,
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export function skipTake(page: number, pageSize: number) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}
