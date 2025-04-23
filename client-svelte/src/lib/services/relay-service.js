import { useNDK } from '@nostr-dev-kit/ndk-svelte';
import { writable } from 'svelte/store';
import { db } from '../db/db';
import { toast } from '../stores/toast';
import { isValidRelayUrl } from './ndk-config';

// Store for relay status
const createRelayStore = () => {
  const { subscribe, set, update } = writable({
    relays: [],
    isLoading: false,
    error: null
  });
  
  return {
    subscribe,
    
    // Refresh the relay status
    refresh: async () => {
      update(state => ({ ...state, isLoading: true, error: null }));
      
      try {
        const { ndk } = useNDK();
        
        // Get relays from NDK
        const relayStatuses = Array.from(ndk.pool.relays.values()).map(relay => ({
          url: relay.url,
          connected: relay.connected,
          connecting: relay.connecting
        }));
        
        // Update store
        update(state => ({
          ...state,
          relays: relayStatuses,
          isLoading: false
        }));
        
        return relayStatuses;
      } catch (error) {
        console.error('Error getting relay status:', error);
        
        update(state => ({
          ...state,
          error: 'Failed to get relay status',
          isLoading: false
        }));
        
        return [];
      }
    },
    
    // Check connection to a specific relay
    checkConnection: async (url) => {
      if (!isValidRelayUrl(url)) {
        toast.error(`Invalid relay URL: ${url}`);
        return false;
      }
      
      update(state => ({
        ...state,
        relays: state.relays.map(r => 
          r.url === url ? { ...r, checking: true } : r
        )
      }));
      
      try {
        const { ndk } = useNDK();
        const relay = ndk.pool.relays.get(url);
        
        if (!relay) {
          throw new Error(`Relay ${url} not found in NDK pool`);
        }
        
        // Try to connect with timeout
        const connected = await Promise.race([
          relay.connect().then(() => true),
          new Promise(resolve => setTimeout(() => resolve(false), 5000))
        ]);
        
        update(state => ({
          ...state,
          relays: state.relays.map(r => 
            r.url === url ? { ...r, connected, checking: false } : r
          )
        }));
        
        return connected;
      } catch (error) {
        console.error(`Error connecting to relay ${url}:`, error);
        
        update(state => ({
          ...state,
          relays: state.relays.map(r => 
            r.url === url ? { ...r, connected: false, checking: false } : r
          )
        }));
        
        return false;
      }
    }
  };
};

// Create relay store instance
export const relayStore = createRelayStore();

/**
 * Add a new relay URL to NDK and store it
 * @param {string} url - Relay URL to add
 * @returns {Promise<boolean>} - Success status
 */
export async function addRelay(url) {
  // Validate the URL
  if (!isValidRelayUrl(url)) {
    toast.error('Invalid relay URL. Must start with wss:// or ws://');
    return false;
  }
  
  try {
    const { ndk } = useNDK();
    
    // Check if relay already exists
    if (ndk.pool.relays.has(url)) {
      toast.info(`Relay ${url} already exists`);
      return true;
    }
    
    // Add to NDK
    await ndk.pool.addRelay(url);
    
    // Add to database
    await db.storeRelay(url);
    
    // Update store
    relayStore.refresh();
    
    toast.success(`Added relay: ${url}`);
    return true;
  } catch (error) {
    console.error('Error adding relay:', error);
    toast.error(`Failed to add relay: ${error.message}`);
    return false;
  }
}

/**
 * Remove a relay from NDK and database
 * @param {string} url - Relay URL to remove
 * @returns {Promise<boolean>} - Success status
 */
export async function removeRelay(url) {
  try {
    const { ndk } = useNDK();
    
    // Validate
    if (!url) return false;
    
    // Check if relay exists
    if (!ndk.pool.relays.has(url)) {
      toast.info(`Relay ${url} doesn't exist`);
      
      // Remove from database anyway
      await db.removeRelay(url);
      return true;
    }
    
    // Remove from NDK
    ndk.pool.removeRelay(url);
    
    // Remove from database
    await db.removeRelay(url);
    
    // Update store
    relayStore.refresh();
    
    toast.success(`Removed relay: ${url}`);
    return true;
  } catch (error) {
    console.error('Error removing relay:', error);
    toast.error(`Failed to remove relay: ${error.message}`);
    return false;
  }
}

/**
 * Get all relays from database and sync with NDK
 * @returns {Promise<Array>} - Array of relay URLs
 */
export async function syncRelays() {
  try {
    const { ndk } = useNDK();
    
    // Get relays from database
    const dbRelays = await db.getRelays();
    
    // Get relays from NDK
    const ndkRelays = Array.from(ndk.pool.relays.keys());
    
    // Add missing relays to NDK
    for (const relay of dbRelays) {
      if (!ndkRelays.includes(relay.url)) {
        await ndk.pool.addRelay(relay.url);
      }
    }
    
    // Add NDK relays to database (if not already there)
    for (const url of ndkRelays) {
      if (!dbRelays.some(r => r.url === url)) {
        await db.storeRelay(url);
      }
    }
    
    // Update store
    relayStore.refresh();
    
    return ndkRelays;
  } catch (error) {
    console.error('Error syncing relays:', error);
    return [];
  }
}