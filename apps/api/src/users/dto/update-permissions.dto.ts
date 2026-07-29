import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

class PermissionGrant {
  @IsString()
  permissionKey!: string;

  @IsOptional()
  @IsString()
  ownerId?: string;
}

export class UpdatePermissionsDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionGrant)
  grants?: PermissionGrant[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionGrant)
  revokes?: PermissionGrant[];
}
