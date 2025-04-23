import NDK from '@nostr-dev-kit/ndk';
import NDKCacheAdapterDexie from '@nostr-dev-kit/ndk-cache-dexie';
import { writable } from 'svelte/store';

// Create a store for NDK instance
export const ndkStore = writable(null);

// Default relays
const defaultRelays = [
  'wss://relay.mynodus.com',
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://nostr.wine'
];

/**
 * Initialize NDK with provided relays and caching
 * @param {string[]} relays List of relay URLs to connect to
 * @returns {NDK} NDK instance
 */
export const initializeNDK = async (relays = defaultRelays) => {
  // Create cache adapter
  const cacheAdapter = new NDKCacheAdapterDexie({ dbName: 'nodus-cache' });
  
  // Create NDK instance
  const ndk = new NDK({
    explicitRelayUrls: relays,
    enableOutboxModel: true,
    cacheAdapter
  });
  
  // Connect to relays
  await ndk.connect();
  
  // Update the store
  ndkStore.set(ndk);
  
  console.log(`Connected to ${relays.length} relays:`, relays);
  
  return ndk;
};

/**
 * Add a new relay to the NDK instance
 * @param {string} url Relay URL to add
 * @returns {Promise<boolean>} Success status
 */
export const addRelay = async (url) => {
  let ndk;
  ndkStore.subscribe(value => ndk = value)();
  
  if (!ndk) {
    console.error('NDK not initialized');
    return false;
  }
  
  try {
    await ndk.pool.addRelay(url);
    console.log(`Added relay: ${url}`);
    return true;
  } catch (error) {
    console.error(`Failed to add relay ${url}:`, error);
    return false;
  }
};

/**
 * Remove a relay from the NDK instance
 * @param {string} url Relay URL to remove
 * @returns {Promise<boolean>} Success status
 */
export const removeRelay = async (url) => {
  let ndk;
  ndkStore.subscribe(value => ndk = value)();
  
  if (!ndk) {
    console.error('NDK not initialized');
    return false;
  }
  
  try {
    await ndk.pool.removeRelay(url);
    console.log(`Removed relay: ${url}`);
    return true;
  } catch (error) {
    console.error(`Failed to remove relay ${url}:`, error);
    return false;
  }
};

/**
 * Get the current relay connection status
 * @returns {Promise<Array<{url: string, connected: boolean}>>} List of relays with connection status
 */
export const getRelayStatus = async () => {
  let ndk;
  ndkStore.subscribe(value => ndk = value)();
  
  if (!ndk) {
    console.error('NDK not initialized');
    return [];
  }
  
  const relays = [];
  
  for (const [url, relay] of Object.entries(ndk.pool.relays)) {
    relays.push({
      url,
      connected: relay.status === 1 // WebSocket.OPEN
    });
  }
  
  return relays;
};

// Initialize NDK on module import
initializeNDK();