import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedUser } from '../types/authenticated-user';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request);
    if (!token) throw new UnauthorizedException('Missing access token');

    let payload: AuthenticatedUser;
    try {
      payload = await this.jwtService.verifyAsync<AuthenticatedUser>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    // A tokenVersion bump (account disabled, forced logout) invalidates
    // every access token issued before it, even ones still inside their
    // 15-minute TTL (Phase 4 §1).
    const user = await this.prisma.client.user.findFirst({
      where: { id: payload.id },
      select: { tokenVersion: true },
    });
    if (!user || user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Session has been revoked');
    }

    (request as Request & { user: AuthenticatedUser }).user = payload;
    return true;
  }
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length);
}
