import { Module } from '@nestjs/common';
import { APP_STORE_LIB, appStoreLib } from './app-store.lib';
import { AppStoreProvider } from './app-store.provider';
import { GooglePlayProvider } from './google-play.provider';
import { StoreProviderRegistry } from './store-provider.registry';

@Module({
  providers: [
    { provide: APP_STORE_LIB, useValue: appStoreLib },
    AppStoreProvider,
    GooglePlayProvider,
    StoreProviderRegistry,
  ],
  exports: [StoreProviderRegistry],
})
export class StoreProvidersModule {}
