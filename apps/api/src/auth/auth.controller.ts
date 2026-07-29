import { Body, Controller, Get, Param, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';

const REFRESH_COOKIE = 'refreshToken';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } }) // Phase 4 §4 — 5 attempts / 15 min per IP
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto.email, dto.password, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, refreshToken: result.refreshToken, user: result.user };
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawToken = req.cookies?.[REFRESH_COOKIE] ?? dto.refreshToken;
    if (!rawToken) throw new UnauthorizedException('No refresh token provided');

    const tokens = await this.auth.refresh(rawToken, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    this.setRefreshCookie(res, tokens.refreshToken);
    return tokens;
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
    if (rawToken) await this.auth.logout(rawToken);
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
    return { success: true };
  }

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id);
  }

  @Public()
  @Get('invites/:token')
  async previewInvite(@Param('token') token: string) {
    return this.auth.previewInvite(token);
  }

  @Public()
  @Post('invites/:token/accept')
  async acceptInvite(
    @Param('token') token: string,
    @Body() dto: AcceptInviteDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.acceptInvite(token, dto.password, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    this.setRefreshCookie(res, result.refreshToken);
    return result;
  }

  private cookieOptions() {
    // Frontend (Vercel) and API (Render) live on different domains in
    // production, so the cookie must be SameSite=None to be sent cross-site
    // at all — which browsers only allow alongside Secure. Locally both run
    // on http://localhost, where Secure cookies aren't sent, so dev keeps
    // Lax/non-secure.
    const isProd = this.config.get('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
      path: '/v1/auth',
    };
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE, token, { ...this.cookieOptions(), maxAge: 30 * 24 * 60 * 60 * 1000 });
  }
}
