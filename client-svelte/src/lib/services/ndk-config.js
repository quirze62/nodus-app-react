import NDK from '@nostr-dev-kit/ndk';
import { NDKCacheAdapterDexie } from '@nostr-dev-kit/ndk-cache-dexie';
import { db } from '../db/db';
import { toast } from '../stores/toast';

// Default relays
const DEFAULT_RELAYS = [
  'wss://relay.mynodus.com',
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.current.fyi',
  'wss://nostr.wine',
  'wss://relay.nostr.band'
];

// Global NDK instance
let ndkInstance = null;

// Initialize NDK
export async function initNDK() {
  if (ndkInstance) return ndkInstance;
  
  try {
    console.info('[INFO] Initializing Nostr client with NDK');
    
    // Create a cache adapter with Dexie
    const cacheAdapter = new NDKCacheAdapterDexie({
      dbName: 'nodus-ndk-cache'
    });
    
    // Get stored relays from DB
    let relayUrls;
    try {
      const relays = await db.getRelays();
      relayUrls = relays.map(r => r.url);
      
      // If no relays found, use defaults
      if (!relayUrls.length) {
        relayUrls = DEFAULT_RELAYS;
        
        // Store default relays for future use
        for (const url of DEFAULT_RELAYS) {
          await db.storeRelay(url);
        }
      }
    } catch (err) {
      console.error('Error loading relays from db:', err);
      relayUrls = DEFAULT_RELAYS;
    }
    
    // Configure NDK
    ndkInstance = new NDK({
      explicitRelayUrls: relayUrls,
      enableOutboxModel: true,
      cacheAdapter,
      autoConnectUserRelays: true,
      autoFetchUserMutelist: true,
      debug: true
    });
    
    // Initialize signer
    await ndkInstance.connect();
    
    return ndkInstance;
  } catch (error) {
    console.error('Error initializing NDK:', error);
    toast.error('Failed to initialize Nostr client');
    throw error;
  }
}

// Get the NDK instance
export function getNDK() {
  if (!ndkInstance) {
    throw new Error('NDK not initialized. Call initNDK() first.');
  }
  
  return ndkInstance;
}

// Add a user's private key to NDK
export async function setUserPrivateKey(privateKey) {
  try {
    const ndk = await initNDK();
    
    // Create a signer from private key
    const signer = NDK.signer.nip07.fromPrivateKey(privateKey);
    
    // Set the signer in NDK
    ndk.signer = signer;
    
    return true;
  } catch (error) {
    console.error('Error setting user private key:', error);
    toast.error('Failed to set private key');
    throw error;
  }
}

// Add a relay to NDK
export async function addRelay(url) {
  try {
    const ndk = await initNDK();
    
    // Add to NDK
    await ndk.pool.addRelay(url);
    
    // Store in database
    await db.storeRelay(url);
    
    toast.success(`Added relay: ${url}`);
    return true;
  } catch (error) {
    console.error(`Error adding relay ${url}:`, error);
    toast.error(`Failed to add relay: ${error.message}`);
    throw error;
  }
}

// Remove a relay from NDK
export async function removeRelay(url) {
  try {
    const ndk = await initNDK();
    
    // Remove from NDK
    ndk.pool.removeRelay(url);
    
    // Remove from database
    await db.removeRelay(url);
    
    toast.info(`Removed relay: ${url}`);
    return true;
  } catch (error) {
    console.error(`Error removing relay ${url}:`, error);
    toast.error(`Failed to remove relay: ${error.message}`);
    throw error;
  }
}

// Get all relays from NDK
export async function getRelays() {
  try {
    const ndk = await initNDK();
    
    // Get relays from NDK
    const relays = ndk.pool.relays;
    
    // Convert to array with connection status
    return Array.from(relays.entries()).map(([url, relay]) => ({
      url,
      connected: relay.connectionStatus === 1, // 1 = connected
      read: true,
      write: true
    }));
  } catch (error) {
    console.error('Error getting relays:', error);
    toast.error('Failed to get relays');
    throw error;
  }
}

// A wrapper component for NDK that can be used in Svelte components
export const NDKProvider = {
  NDK: ndkInstance
};