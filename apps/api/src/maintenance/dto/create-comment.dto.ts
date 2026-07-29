import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsString()
  proposalId?: string;

  @IsOptional()
  @IsBoolean()
  visibleToTenant?: boolean;
}
