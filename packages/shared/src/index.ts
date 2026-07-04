/**
 * @asobeast/shared
 *
 * Design rule: this package is runtime agnostic and dependency light. It holds
 * contract types shared between the API and the web app, the `Store` union, the
 * store URL parser (Phase 2), normalization helpers and constants. It must never
 * import Nest, Next or Prisma — nothing runtime specific may leak in here.
 */

export const STORES = ['APP_STORE', 'GOOGLE_PLAY'] as const;
export type Store = (typeof STORES)[number];

/** Stores actively scraped in this version. */
export const SUPPORTED_STORES: readonly Store[] = ['APP_STORE'];

export const DEFAULT_COUNTRY = 'us';

export interface HealthStatus {
  status: 'ok' | 'error';
  db: 'up' | 'down';
}

export * from './url-parser';
export * from './contracts';
export * from './text';
