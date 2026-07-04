import { Store } from '@prisma/client';

export class StoreRequestError extends Error {
  constructor(
    readonly store: Store,
    readonly method: string,
    readonly causeMessage: string,
  ) {
    super(`${store} ${method} failed: ${causeMessage}`);
    this.name = 'StoreRequestError';
  }
}

export class StoreNotSupportedError extends Error {
  constructor(readonly store: Store) {
    super(`Store ${store} is not supported`);
    this.name = 'StoreNotSupportedError';
  }
}
