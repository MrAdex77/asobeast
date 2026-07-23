import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from '../auth.service';
import type { AuthenticatedRequest } from '../auth.types';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.auth.enabled) return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context
      .switchToHttp()
      .getRequest<Request & AuthenticatedRequest>();
    const cookies = req.cookies as Record<string, string> | undefined;
    const user =
      (await this.auth.resolveSessionUser(cookies?.[this.auth.cookieName])) ??
      (await this.auth.resolveTokenUser(req.headers.authorization));
    if (!user) throw new UnauthorizedException('Not authenticated');

    req.user = user;
    return true;
  }
}
