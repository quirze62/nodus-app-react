import NDK from '@nostr-dev-kit/ndk';
import NDKCacheAdapterDexie from '@nostr-dev-kit/ndk-cache-dexie';
import { writable } from 'svelte/store';
import { user } from '../stores/auth.js';
import { db } from '../db/db.js';

// Store to hold NDK instance
export const ndkStore = writable(null);

// Store to hold error message
export const ndkError = writable(null);

// Store for relay status
export const relayStatus = writable([]);

// Default relays to connect to
const DEFAULT_RELAYS = [
  'wss://relay.mynodus.com',
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.nostr.wine'
];

// Nostr NDK instance
let ndk = null;

// Function to initialize NDK
export async function initializeNDK() {
  try {
    console.info('[INFO] Initializing NDK...');
    
    // Create NDK cache adapter
    const cacheAdapter = new NDKCacheAdapterDexie({
      dbName: 'nodus-ndk-cache'
    });
    
    // Create NDK instance
    ndk = new NDK({
      explicitRelayUrls: DEFAULT_RELAYS,
      cacheAdapter,
      autoConnectUserRelays: true,
      enableOutboxModel: true
    });
    
    // Connect to relays
    await ndk.connect();
    
    // Try to get saved relays for reconnection
    await loadSavedRelays();
    
    // Subscribe to user store to sign in user when available
    user.subscribe(async (userData) => {
      if (userData && ndk) {
        // Set the user's key in NDK
        console.info('[INFO] Setting user in NDK');
        ndk.signer = {
          user: { hexpubkey: userData.publicKey },
          signEvent: async (event) => {
            const signedEvent = await signEventWithPrivateKey(event, userData.privateKey);
            return signedEvent;
          }
        };
      }
    });
    
    // Update relay status
    updateRelayStatus();
    
    // Update the NDK store
    ndkStore.set(ndk);
    
    console.info('[INFO] NDK initialized successfully');
    return true;
  } catch (error) {
    console.error('[ERROR] Failed to initialize NDK:', error);
    ndkError.set(error.message || 'Failed to initialize NDK');
    return false;
  }
}

// Function to sign an event with a private key
async function signEventWithPrivateKey(event, privateKey) {
  // Use nostr-tools to sign the event
  try {
    const { getEventHash, signEvent } = await import('nostr-tools');
    
    event.id = getEventHash(event);
    event.sig = signEvent(event, privateKey);
    
    return event;
  } catch (error) {
    console.error('[ERROR] Failed to sign event:', error);
    throw error;
  }
}

// Function to load saved relays from the database
async function loadSavedRelays() {
  try {
    // This is a placeholder - in a real implementation, we would load
    // saved relays from the database and add them to NDK
    
    // For now, just update relay status
    updateRelayStatus();
  } catch (error) {
    console.error('[ERROR] Failed to load saved relays:', error);
  }
}

// Function to update relay status
async function updateRelayStatus() {
  if (!ndk) return;
  
  try {
    const relays = ndk.pool.relays;
    const status = [];
    
    // Get status of each relay
    for (const [url, relay] of relays) {
      status.push({
        url,
        connected: relay.connected
      });
    }
    
    // Update the relay status store
    relayStatus.set(status);
  } catch (error) {
    console.error('[ERROR] Failed to update relay status:', error);
  }
}

// Function to get relay status
export async function getRelayStatus() {
  if (!ndk) {
    throw new Error('NDK not initialized');
  }
  
  updateRelayStatus();
  
  // Get current value of relayStatus store
  let currentStatus;
  relayStatus.subscribe(value => {
    currentStatus = value;
  })();
  
  return currentStatus;
}

// Function to add a relay
export async function addRelay(url) {
  if (!ndk) {
    throw new Error('NDK not initialized');
  }
  
  try {
    await ndk.pool.addRelay(url);
    updateRelayStatus();
    return true;
  } catch (error) {
    console.error('[ERROR] Failed to add relay:', error);
    return false;
  }
}

// Function to remove a relay
export async function removeRelay(url) {
  if (!ndk) {
    throw new Error('NDK not initialized');
  }
  
  try {
    // Get the relay from the pool
    const relay = ndk.pool.relays.get(url);
    
    if (relay) {
      // Remove the relay from the pool
      ndk.pool.removeRelay(url);
      updateRelayStatus();
      return true;
    } else {
      console.warn(`[WARN] Relay ${url} not found in pool`);
      return false;
    }
  } catch (error) {
    console.error('[ERROR] Failed to remove relay:', error);
    return false;
  }
}

// Export NDK instance getter
export function getNDK() {
  return ndk;
}