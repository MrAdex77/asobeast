export interface AuthStatus {
  enabled: boolean;
  billing: boolean;
  registrationOpen: boolean;
  authenticated: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  plan: string;
  trialEndsAt: string | null;
  planExpiresAt: string | null;
  entitled: boolean;
}
