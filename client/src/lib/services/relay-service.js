import { writable } from 'svelte/store';
import { getNDK, initNDK, addRelay as addNDKRelay, removeRelay as removeNDKRelay } from './ndk-config';
import { db } from '../db/db';
import { toast } from '../stores/toast';

// Create a store for the relay state
const createRelayStore = () => {
  // Initial state
  const state = {
    relays: [],
    isLoading: true,
    error: null
  };
  
  const { subscribe, set, update } = writable(state);
  
  return {
    subscribe,
    
    // Refresh relay data
    refresh: async () => {
      update(state => ({ ...state, isLoading: true }));
      
      try {
        // Get relays from database
        const dbRelays = await db.getRelays();
        
        // Initialize NDK if not already initialized
        const ndk = await initNDK();
        
        // Get relays from NDK
        const ndkRelays = ndk.pool?.relays || new Map();
        
        // Merge data
        const relays = dbRelays.map(dbRelay => {
          const ndkRelay = ndkRelays.get(dbRelay.url);
          
          return {
            url: dbRelay.url,
            connected: ndkRelay?.connectionStatus === 1, // 1 = connected
            checking: false,
            read: dbRelay.read ?? true,
            write: dbRelay.write ?? true
          };
        });
        
        set({
          relays,
          isLoading: false,
          error: null
        });
        
        return relays;
      } catch (error) {
        console.error('Error refreshing relays:', error);
        
        update(state => ({
          ...state,
          isLoading: false,
          error: error.message
        }));
        
        return [];
      }
    },
    
    // Check connection to a relay
    checkConnection: async (url) => {
      update(state => ({
        ...state,
        relays: state.relays.map(relay =>
          relay.url === url ? { ...relay, checking: true } : relay
        )
      }));
      
      try {
        // Initialize NDK if not already initialized
        const ndk = await initNDK();
        
        // Attempt to connect to the relay
        const relay = ndk.pool?.relays.get(url);
        
        if (relay) {
          // Reset connection
          relay.disconnect();
          await relay.connect();
          
          // Get connection status
          const connected = relay.connectionStatus === 1; // 1 = connected
          
          // Update status in the store
          update(state => ({
            ...state,
            relays: state.relays.map(r =>
              r.url === url ? { ...r, connected, checking: false } : r
            )
          }));
          
          // Update status in database
          await db.updateRelayStatus(url, connected);
          
          // Show toast
          if (connected) {
            toast.success(`Connected to ${url}`);
          } else {
            toast.error(`Failed to connect to ${url}`);
          }
          
          return connected;
        } else {
          // Relay not found in NDK pool
          update(state => ({
            ...state,
            relays: state.relays.map(r =>
              r.url === url ? { ...r, connected: false, checking: false } : r
            )
          }));
          
          toast.error(`Relay ${url} not found in NDK pool`);
          return false;
        }
      } catch (error) {
        console.error(`Error checking connection to ${url}:`, error);
        
        // Update status in the store
        update(state => ({
          ...state,
          relays: state.relays.map(r =>
            r.url === url ? { ...r, connected: false, checking: false } : r
          )
        }));
        
        toast.error(`Error checking connection: ${error.message}`);
        return false;
      }
    }
  };
};

// Create and export the store
export const relayStore = createRelayStore();

// Initialize the store on creation
relayStore.refresh().catch(err => console.error('Error initializing relay store:', err));

// Add a relay
export async function addRelay(url) {
  try {
    // Check if URL is valid
    if (!url.startsWith('wss://')) {
      url = `wss://${url}`;
    }
    
    // Check if already exists
    const relays = await db.getRelays();
    const exists = relays.some(relay => relay.url === url);
    
    if (exists) {
      toast.info(`Relay ${url} already exists`);
      return true;
    }
    
    // Add to NDK
    await addNDKRelay(url);
    
    // Add to database
    await db.storeRelay(url);
    
    // Refresh relay store
    await relayStore.refresh();
    
    return true;
  } catch (error) {
    console.error(`Error adding relay ${url}:`, error);
    toast.error(`Failed to add relay: ${error.message}`);
    throw error;
  }
}

// Remove a relay
export async function removeRelay(url) {
  try {
    // Remove from NDK
    await removeNDKRelay(url);
    
    // Remove from database
    await db.removeRelay(url);
    
    // Refresh relay store
    await relayStore.refresh();
    
    return true;
  } catch (error) {
    console.error(`Error removing relay ${url}:`, error);
    toast.error(`Failed to remove relay: ${error.message}`);
    throw error;
  }
}

// Sync relays
export async function syncRelays() {
  try {
    // Get relays from database
    const relays = await db.getRelays();
    
    // Get NDK instance
    const ndk = await initNDK();
    
    // Add each relay to NDK
    for (const relay of relays) {
      try {
        await ndk.pool.addRelay(relay.url);
      } catch (error) {
        console.error(`Error adding relay ${relay.url} to NDK:`, error);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error syncing relays:', error);
    return false;
  }
}