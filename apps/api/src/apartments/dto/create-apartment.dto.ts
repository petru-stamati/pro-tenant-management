import { IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { ApartmentStatus, FurnishedStatus } from '@pro-tenant/db';

export class CreateApartmentDto {
  @IsString()
  ownerId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  addressLine!: string;

  @IsString()
  city!: string;

  @IsOptional()
  @IsString()
  sector?: string;

  @IsOptional()
  @IsString()
  building?: string;

  @IsOptional()
  @IsInt()
  floor?: number;

  @IsOptional()
  @IsInt()
  totalFloors?: number;

  @IsOptional()
  @IsNumber()
  surfaceM2?: number;

  @IsOptional()
  @IsString()
  rooms?: string;

  @IsOptional()
  @IsEnum(FurnishedStatus)
  furnished?: FurnishedStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  extras?: string[];

  @IsOptional()
  @IsEnum(ApartmentStatus)
  status?: ApartmentStatus;
}
