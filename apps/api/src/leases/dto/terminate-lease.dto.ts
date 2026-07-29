import { IsString, MinLength } from 'class-validator';

export class TerminateLeaseDto {
  @IsString()
  @MinLength(1)
  reason!: string;
}
