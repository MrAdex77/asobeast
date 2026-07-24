export interface EntitlementUser {
  plan: string;
  trialEndsAt: Date | null;
  planExpiresAt: Date | null;
}

export const isEntitled = (user: EntitlementUser, now: Date): boolean =>
  (user.plan === 'premium' &&
    (user.planExpiresAt === null || user.planExpiresAt > now)) ||
  (user.trialEndsAt !== null && user.trialEndsAt > now);
