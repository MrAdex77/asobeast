import type { User } from '@prisma/client';

export interface SessionClaims {
  sub: string;
  sv: number;
}

export type AuthenticatedRequest = {
  user?: User;
};
