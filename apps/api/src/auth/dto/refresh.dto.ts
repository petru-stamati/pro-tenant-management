import { IsOptional, IsString } from 'class-validator';

/** Web relies on the httpOnly cookie; mobile has no cookie jar, so it sends the refresh token in the body instead. */
export class RefreshDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
