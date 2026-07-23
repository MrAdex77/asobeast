"use client";

import { useQuery } from "@tanstack/react-query";
import type { AuthStatus, AuthUser } from "@asobeast/shared";
import { authMeOptions, authStatusOptions } from "@/lib/queries";

export interface AuthState {
  status: AuthStatus | undefined;
  user: AuthUser | undefined;
  isLoading: boolean;
  trialOnly: boolean;
}

export function useAuth(): AuthState {
  const { data: status, isLoading: statusLoading } =
    useQuery(authStatusOptions);
  const authenticated = Boolean(status?.enabled && status.authenticated);
  const { data: user, isLoading: userLoading } = useQuery({
    ...authMeOptions,
    enabled: authenticated,
  });

  const trialOnly = Boolean(
    user?.entitled && user.plan !== "premium" && user.trialEndsAt !== null,
  );

  return {
    status,
    user: authenticated ? user : undefined,
    isLoading: statusLoading || (authenticated && userLoading),
    trialOnly,
  };
}
