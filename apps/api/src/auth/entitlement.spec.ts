import { isEntitled } from './entitlement';

describe('isEntitled', () => {
  const now = new Date('2026-07-23T00:00:00Z');
  const past = new Date('2026-07-01T00:00:00Z');
  const future = new Date('2026-08-01T00:00:00Z');

  it('entitles a premium plan with no expiry', () => {
    expect(
      isEntitled(
        { plan: 'premium', planExpiresAt: null, trialEndsAt: null },
        now,
      ),
    ).toBe(true);
  });

  it('entitles a premium plan that expires in the future', () => {
    expect(
      isEntitled(
        { plan: 'premium', planExpiresAt: future, trialEndsAt: null },
        now,
      ),
    ).toBe(true);
  });

  it('rejects a premium plan that has expired', () => {
    expect(
      isEntitled(
        { plan: 'premium', planExpiresAt: past, trialEndsAt: null },
        now,
      ),
    ).toBe(false);
  });

  it('entitles an active trial', () => {
    expect(
      isEntitled(
        { plan: 'free', planExpiresAt: null, trialEndsAt: future },
        now,
      ),
    ).toBe(true);
  });

  it('rejects an expired trial', () => {
    expect(
      isEntitled({ plan: 'free', planExpiresAt: null, trialEndsAt: past }, now),
    ).toBe(false);
  });

  it('rejects a free plan with no trial', () => {
    expect(
      isEntitled({ plan: 'free', planExpiresAt: null, trialEndsAt: null }, now),
    ).toBe(false);
  });
});
