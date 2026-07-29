import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateOwnerDto {
  @IsString()
  @MinLength(1)
  companyName!: string;

  @IsString()
  @MinLength(1)
  contactName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
