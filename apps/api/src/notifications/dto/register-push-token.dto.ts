import { IsEnum, IsString } from 'class-validator';
import { DevicePlatform } from '@pro-tenant/db';

export class RegisterPushTokenDto {
  @IsString()
  token!: string;

  @IsEnum(DevicePlatform)
  platform!: DevicePlatform;
}
