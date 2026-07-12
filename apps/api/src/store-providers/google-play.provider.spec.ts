import { Store } from '@prisma/client';
import { StoreNotSupportedError } from './errors';
import { GooglePlayProvider } from './google-play.provider';

describe('GooglePlayProvider', () => {
  const provider = new GooglePlayProvider();

  it('reports the Google Play store', () => {
    expect(provider.store).toBe(Store.GOOGLE_PLAY);
  });

  it('rejects getApp with StoreNotSupportedError', async () => {
    await expect(provider.getApp()).rejects.toBeInstanceOf(
      StoreNotSupportedError,
    );
  });

  it('rejects search with StoreNotSupportedError', async () => {
    await expect(provider.search()).rejects.toBeInstanceOf(
      StoreNotSupportedError,
    );
  });

  it('rejects suggest with StoreNotSupportedError', async () => {
    await expect(provider.suggest()).rejects.toBeInstanceOf(
      StoreNotSupportedError,
    );
  });

  it('rejects similar with StoreNotSupportedError', async () => {
    await expect(provider.similar()).rejects.toBeInstanceOf(
      StoreNotSupportedError,
    );
  });

  it('rejects topCharts with StoreNotSupportedError', async () => {
    await expect(provider.topCharts()).rejects.toBeInstanceOf(
      StoreNotSupportedError,
    );
  });
});
