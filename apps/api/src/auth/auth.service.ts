import { createHash, randomBytes } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { CookieOptions } from 'express';
import * as argon2 from 'argon2';
import type { AuthUser } from '@asobeast/shared';
import type { User } from '@prisma/client';
import { DEFAULT_WORKSPACE_ID } from '../common/workspace';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { API_TOKEN_PREFIX, SESSION_COOKIE } from './auth.constants';
import { isEntitled } from './entitlement';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import type { SessionClaims } from './auth.types';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  get enabled(): boolean {
    return this.config.get('AUTH_ENABLED', { infer: true });
  }

  get billing(): boolean {
    return this.config.get('BILLING_ENABLED', { infer: true });
  }

  async register(dto: RegisterDto): Promise<{ user: User; token: string }> {
    this.assertEnabled();
    const email = normalizeEmail(dto.email);
    const userCount = await this.prisma.user.count();
    const bootstrap = userCount === 0;
    if (!bootstrap && !this.registrationAllowed()) {
      throw new ForbiddenException('Registration is closed');
    }
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await argon2.hash(dto.password);
    const trialEndsAt = this.billing
      ? new Date(
          Date.now() + this.config.get('TRIAL_DAYS', { infer: true }) * DAY_MS,
        )
      : null;
    const user = await this.prisma.user.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        email,
        passwordHash,
        name: dto.name ?? null,
        role: bootstrap ? 'owner' : 'member',
        trialEndsAt,
      },
    });
    return { user, token: await this.sign(user) };
  }

  async login(dto: LoginDto): Promise<{ user: User; token: string }> {
    this.assertEnabled();
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    const hash = user?.passwordHash ?? (await this.getDummyHash());
    const valid = await argon2.verify(hash, dto.password);
    if (!user || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return { user, token: await this.sign(user) };
  }

  async requireSessionUser(token: string | undefined): Promise<User> {
    this.assertEnabled();
    const user = await this.resolveSessionUser(token);
    if (!user) throw new UnauthorizedException('Not authenticated');
    return user;
  }

  async resolveSessionUser(token: string | undefined): Promise<User | null> {
    if (!token) return null;
    let claims: SessionClaims;
    try {
      claims = await this.jwt.verifyAsync<SessionClaims>(token);
    } catch {
      return null;
    }
    const user = await this.prisma.user.findUnique({
      where: { id: claims.sub },
    });
    if (!user || user.sessionVersion !== claims.sv) return null;
    return user;
  }

  async resolveTokenUser(
    authorization: string | undefined,
  ): Promise<User | null> {
    const raw = bearerToken(authorization);
    if (!raw?.startsWith(API_TOKEN_PREFIX)) return null;
    const record = await this.prisma.apiToken.findUnique({
      where: { tokenHash: sha256(raw) },
      include: { user: true },
    });
    if (!record) return null;
    void this.prisma.apiToken
      .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
    return record.user;
  }

  async status(token: string | undefined) {
    const authenticated = this.enabled
      ? (await this.resolveSessionUser(token)) !== null
      : false;
    return {
      enabled: this.enabled,
      billing: this.billing,
      registrationOpen: await this.registrationOpen(),
      authenticated,
    };
  }

  async sign(user: User): Promise<string> {
    const claims: SessionClaims = { sub: user.id, sv: user.sessionVersion };
    return this.jwt.signAsync(claims);
  }

  toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      plan: user.plan,
      trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
      planExpiresAt: user.planExpiresAt?.toISOString() ?? null,
      entitled: this.entitled(user),
    };
  }

  cookieOptions(): CookieOptions {
    return {
      ...this.baseCookieOptions(),
      maxAge: this.config.get('AUTH_SESSION_DAYS', { infer: true }) * DAY_MS,
    };
  }

  clearCookieOptions(): CookieOptions {
    return this.baseCookieOptions();
  }

  get cookieName(): string {
    return SESSION_COOKIE;
  }

  entitled(user: User): boolean {
    return !this.billing || isEntitled(user, new Date());
  }

  private baseCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: this.config.get('AUTH_COOKIE_SECURE', { infer: true }),
    };
  }

  private registrationAllowed(): boolean {
    return (
      this.billing ||
      this.config.get('AUTH_ALLOW_REGISTRATION', { infer: true })
    );
  }

  private async registrationOpen(): Promise<boolean> {
    if (this.registrationAllowed()) return true;
    return (await this.prisma.user.count()) === 0;
  }

  private assertEnabled(): void {
    if (!this.enabled) {
      throw new ConflictException('Authentication is disabled');
    }
  }

  private getDummyHash(): Promise<string> {
    return (this.dummyHash ??= argon2.hash(randomBytes(16).toString('hex')));
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function bearerToken(authorization: string | undefined): string | null {
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
