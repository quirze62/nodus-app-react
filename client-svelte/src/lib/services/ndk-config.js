import { NDKCacheAdapter } from '@nostr-dev-kit/ndk';
import { initializeDb } from '../db/db';

// Default relays for the application
const DEFAULT_RELAYS = [
  'wss://relay.mynodus.com',
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://nostr.wine'
];

/**
 * NDK configuration with caching for local-first architecture
 */
export const ndkConfig = {
  explicitRelayUrls: DEFAULT_RELAYS,
  enableOutboxModel: true, // For offline functionality
  cacheAdapter: new NDKCacheAdapter(), // Built-in NDK caching
  debug: true, // Enable debug logs in development
  
  // Customize network debugging
  netDebug: (message) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[NDK-NET] ${message}`);
    }
  },
  
  // Initialize our database when NDK is ready
  onReady: async () => {
    console.info('NDK is ready, initializing database');
    await initializeDb();
  }
};

/**
 * Function to validate a relay URL
 */
export function isValidRelayUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'wss:' || parsed.protocol === 'ws:';
  } catch (e) {
    return false;
  }
}