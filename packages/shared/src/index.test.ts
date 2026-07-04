import { describe, expect, it } from 'vitest';

import { SUPPORTED_STORES, STORES, DEFAULT_COUNTRY } from './index';

describe('@asobeast/shared constants', () => {
  it('supports only the App Store in this version', () => {
    expect(SUPPORTED_STORES).toEqual(['APP_STORE']);
  });

  it('knows both stores in the union', () => {
    expect(STORES).toContain('APP_STORE');
    expect(STORES).toContain('GOOGLE_PLAY');
  });

  it('defaults to the US region', () => {
    expect(DEFAULT_COUNTRY).toBe('us');
  });
});
