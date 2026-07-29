import { IsString } from 'class-validator';

export class InviteTenantDto {
  @IsString()
  leaseId!: string;
}
