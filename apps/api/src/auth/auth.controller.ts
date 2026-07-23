import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { User } from '@prisma/client';
import type { AuthStatus, AuthUser } from '@asobeast/shared';
import { AuthService } from './auth.service';
import { AllowUnentitled } from './decorators/allow-unentitled.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register an account' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUser> {
    const { user, token } = await this.auth.register(dto);
    res.cookie(this.auth.cookieName, token, this.auth.cookieOptions());
    return this.auth.toAuthUser(user);
  }

  @Post('login')
  @Public()
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Log in' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUser> {
    const { user, token } = await this.auth.login(dto);
    res.cookie(this.auth.cookieName, token, this.auth.cookieOptions());
    return this.auth.toAuthUser(user);
  }

  @Post('logout')
  @AllowUnentitled()
  @HttpCode(204)
  @ApiOperation({ summary: 'Log out' })
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(this.auth.cookieName, this.auth.clearCookieOptions());
  }

  @Get('me')
  @AllowUnentitled()
  @ApiOperation({ summary: 'Current authenticated user' })
  me(@CurrentUser() user: User): AuthUser {
    return this.auth.toAuthUser(user);
  }

  @Post('password')
  @AllowUnentitled()
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Change password and reset other sessions' })
  async changePassword(
    @CurrentUser() user: User,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUser> {
    const { user: updated, token } = await this.auth.changePassword(user, dto);
    res.cookie(this.auth.cookieName, token, this.auth.cookieOptions());
    return this.auth.toAuthUser(updated);
  }

  @Get('status')
  @Public()
  @ApiOperation({ summary: 'Public auth configuration and session state' })
  status(@Req() req: Request): Promise<AuthStatus> {
    const cookies = req.cookies as Record<string, string> | undefined;
    return this.auth.status(cookies?.[this.auth.cookieName]);
  }
}
