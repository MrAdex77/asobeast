import { Store } from '@prisma/client';
import { AppStoreLib } from './app-store.lib';
import { AppStoreProvider } from './app-store.provider';
import { StoreNotSupportedError } from './errors';
import { GooglePlayProvider } from './google-play.provider';
import { StoreProviderRegistry } from './store-provider.registry';

const stubLib: AppStoreLib = {
  app: jest.fn(),
  search: jest.fn(),
  suggest: jest.fn(),
  similar: jest.fn(),
};

describe('StoreProviderRegistry', () => {
  const registry = new StoreProviderRegistry(
    new AppStoreProvider(stubLib),
    new GooglePlayProvider(),
  );

  it('returns the App Store provider for APP_STORE', () => {
    expect(registry.get(Store.APP_STORE)).toBeInstanceOf(AppStoreProvider);
  });

  it('returns the Google Play provider for GOOGLE_PLAY', () => {
    expect(registry.get(Store.GOOGLE_PLAY)).toBeInstanceOf(GooglePlayProvider);
  });

  it('exposes a Google Play provider that rejects with StoreNotSupportedError', async () => {
    await expect(
      registry.get(Store.GOOGLE_PLAY).getApp('1', 'us'),
    ).rejects.toBeInstanceOf(StoreNotSupportedError);
  });
});
