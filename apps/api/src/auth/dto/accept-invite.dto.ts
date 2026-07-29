import { IsOptional, IsString, MinLength } from 'class-validator';

export class AcceptInviteDto {
  /** Omitted when the tenant already has an account from a prior lease (PRD §3.2) — they keep their existing password. */
  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'Password must be at least 10 characters' })
  password?: string;
}
