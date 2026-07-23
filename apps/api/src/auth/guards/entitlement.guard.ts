import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from '../auth.service';
import { AuthenticatedRequest } from '../auth.types';
import { EntitlementRequiredError } from '../auth.errors';
import { ALLOW_UNENTITLED_KEY } from '../decorators/allow-unentitled.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { isEntitled } from '../entitlement';

@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.auth.enabled || !this.auth.billing) return true;

    const bypass = this.reflector.getAllAndOverride<boolean>(
      ALLOW_UNENTITLED_KEY,
      [context.getHandler(), context.getClass()],
    );
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (bypass || isPublic) return true;

    const req = context
      .switchToHttp()
      .getRequest<Request & AuthenticatedRequest>();
    if (!req.user || isEntitled(req.user, new Date())) return true;

    throw new EntitlementRequiredError();
  }
}
