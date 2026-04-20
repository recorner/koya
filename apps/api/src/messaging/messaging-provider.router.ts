import { Inject, Injectable } from '@nestjs/common';
import type { MessagingProviderType } from './messaging.types';
import type { MessagingProvider } from './providers/messaging-provider.interface';
import { MESSAGING_PROVIDERS } from './providers/messaging-provider.interface';

@Injectable()
export class MessagingProviderRouter {
  private readonly providersByType = new Map<MessagingProviderType, MessagingProvider>();

  constructor(
    @Inject(MESSAGING_PROVIDERS)
    providers: MessagingProvider[],
  ) {
    for (const provider of providers) {
      this.providersByType.set(provider.provider, provider);
    }
  }

  getProvider(provider: MessagingProviderType): MessagingProvider {
    const resolved = this.providersByType.get(provider);
    if (!resolved) {
      throw new Error(`Messaging provider not configured: ${provider}`);
    }
    return resolved;
  }

  allProviders(): MessagingProvider[] {
    return [...this.providersByType.values()];
  }
}
