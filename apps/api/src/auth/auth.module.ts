import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PermissionsService } from '../common/permissions.service';

/**
 * Prefers the raw PEM content from JWT_PRIVATE_KEY/JWT_PUBLIC_KEY (how a
 * host like Render supplies secrets — no persistent filesystem to keep a
 * checked-out key file on, and the keys/ dir is gitignored anyway). Falls
 * back to reading a local file path for dev.
 */
function loadKey(config: ConfigService, envVar: string, pathVar: string): Buffer {
  const raw = config.get<string>(envVar);
  if (raw) return Buffer.from(raw);
  return readFileSync(resolve(config.getOrThrow(pathVar)));
}

const jwtModule = JwtModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    privateKey: loadKey(config, 'JWT_PRIVATE_KEY', 'JWT_PRIVATE_KEY_PATH'),
    publicKey: loadKey(config, 'JWT_PUBLIC_KEY', 'JWT_PUBLIC_KEY_PATH'),
    signOptions: {
      algorithm: 'RS256' as const,
      expiresIn: config.get('JWT_ACCESS_TOKEN_TTL', '15m'),
    },
  }),
});

@Module({
  imports: [jwtModule],
  controllers: [AuthController],
  providers: [AuthService, PermissionsService],
  // Re-exported so AppModule's globally-registered JwtAuthGuard (which needs
  // JwtService) and PermissionGuard (which needs PermissionsService) can
  // both resolve their dependencies — see Phase 4 §7 pipeline.
  exports: [jwtModule, PermissionsService],
})
export class AuthModule {}
