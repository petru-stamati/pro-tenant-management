import { IsString, MinLength } from 'class-validator';

export class CancelRequestDto {
  @IsString()
  @MinLength(1)
  reason!: string;
}
