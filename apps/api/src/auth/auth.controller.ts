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
import type { AuthStatus, AuthUser } from '@asobeast/shared';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
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
  @HttpCode(204)
  @ApiOperation({ summary: 'Log out' })
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(this.auth.cookieName, this.auth.clearCookieOptions());
  }

  @Get('me')
  @ApiOperation({ summary: 'Current authenticated user' })
  async me(@Req() req: Request): Promise<AuthUser> {
    const user = await this.auth.requireSessionUser(
      req.cookies?.[this.auth.cookieName] as string | undefined,
    );
    return this.auth.toAuthUser(user);
  }

  @Get('status')
  @ApiOperation({ summary: 'Public auth configuration and session state' })
  status(@Req() req: Request): Promise<AuthStatus> {
    return this.auth.status(
      req.cookies?.[this.auth.cookieName] as string | undefined,
    );
  }
}
