import NDK, { NDKRelay, NDKRelayStatus } from '@nostr-dev-kit/ndk';
import { db } from './db';
import { getNDK } from './ndk';

// Default Nostr relays for the application
export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.current.fyi',
  'wss://nostr.wine'
];

/**
 * Local storage key for storing user's preferred relays
 */
const USER_RELAYS_KEY = 'nodus_user_relays';

/**
 * Interface for relay with additional metadata
 */
export interface ManagedRelay {
  url: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  read: boolean;
  write: boolean;
  lastConnected?: Date;
  latency?: number; // in ms
}

/**
 * Manages relays for the NDK instance
 */
export class RelayManager {
  private ndk: NDK | null = null;
  private relays: Map<string, ManagedRelay> = new Map();
  private autoReconnect: boolean = true;
  
  constructor() {
    this.loadRelays();
  }
  
  /**
   * Initialize with an NDK instance
   */
  async initialize(ndk: NDK): Promise<void> {
    this.ndk = ndk;
    
    // Check if we need to set initial relays
    if (this.relays.size === 0) {
      // If no relays stored, use defaults
      DEFAULT_RELAYS.forEach(url => {
        this.relays.set(url, {
          url,
          status: 'disconnected',
          read: true,
          write: true
        });
      });
      
      // Save to storage
      this.saveRelays();
    }
    
    // Connect to all enabled relays
    await this.connectToEnabledRelays();
  }
  
  /**
   * Get all managed relays
   */
  getAllRelays(): ManagedRelay[] {
    return Array.from(this.relays.values());
  }
  
  /**
   * Get connected relays
   */
  getConnectedRelays(): ManagedRelay[] {
    return Array.from(this.relays.values())
      .filter(relay => relay.status === 'connected');
  }
  
  /**
   * Add a new relay
   */
  async addRelay(url: string, read: boolean = true, write: boolean = true): Promise<boolean> {
    // Make sure URL is properly formatted
    if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
      url = `wss://${url}`;
    }
    
    // Add to managed relays
    this.relays.set(url, {
      url,
      status: 'disconnected',
      read,
      write
    });
    
    // Save to storage
    this.saveRelays();
    
    // If NDK is initialized, connect to the relay
    if (this.ndk && (read || write)) {
      try {
        await this.connectToRelay(url);
        return true;
      } catch (error) {
        console.error(`Failed to connect to relay ${url}:`, error);
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Remove a relay
   */
  async removeRelay(url: string): Promise<boolean> {
    // Check if relay exists
    if (!this.relays.has(url)) {
      return false;
    }
    
    // Disconnect from the relay if NDK is initialized
    if (this.ndk) {
      try {
        await this.disconnectFromRelay(url);
      } catch (error) {
        console.error(`Failed to disconnect from relay ${url}:`, error);
      }
    }
    
    // Remove from managed relays
    this.relays.delete(url);
    
    // Save to storage
    this.saveRelays();
    
    return true;
  }
  
  /**
   * Update relay settings
   */
  async updateRelay(url: string, read: boolean, write: boolean): Promise<boolean> {
    // Check if relay exists
    if (!this.relays.has(url)) {
      return false;
    }
    
    // Get current relay
    const relay = this.relays.get(url)!;
    
    // Update settings
    relay.read = read;
    relay.write = write;
    this.relays.set(url, relay);
    
    // If NDK is initialized, update relay
    if (this.ndk) {
      try {
        if (!read && !write) {
          // If both read and write are disabled, disconnect
          await this.disconnectFromRelay(url);
        } else if (relay.status !== 'connected') {
          // If disconnected but should be enabled, connect
          await this.connectToRelay(url);
        }
      } catch (error) {
        console.error(`Failed to update relay ${url}:`, error);
      }
    }
    
    // Save to storage
    this.saveRelays();
    
    return true;
  }
  
  /**
   * Connect to a specific relay
   */
  async connectToRelay(url: string): Promise<boolean> {
    if (!this.ndk) {
      this.ndk = await getNDK();
    }
    
    try {
      const relay = this.relays.get(url);
      if (!relay) {
        return false;
      }
      
      // Update status
      relay.status = 'connecting';
      this.relays.set(url, relay);
      
      // Get or add relay from NDK
      const ndkRelays = this.ndk.pool.relays;
      let ndkRelay = ndkRelays.get(url);
      
      // If relay doesn't exist in NDK pool, create a new connection
      if (!ndkRelay) {
        // Create new relay connection
        ndkRelay = new NDKRelay(url);
        // Add to pool
        this.ndk.pool.relays.set(url, ndkRelay);
        // Connect to relay
        await ndkRelay.connect();
      }
      
      // Set up event listeners
      ndkRelay.on('connect', () => {
        const managedRelay = this.relays.get(url);
        if (managedRelay) {
          managedRelay.status = 'connected';
          managedRelay.lastConnected = new Date();
          this.relays.set(url, managedRelay);
        }
      });
      
      ndkRelay.on('disconnect', () => {
        const managedRelay = this.relays.get(url);
        if (managedRelay) {
          managedRelay.status = 'disconnected';
          this.relays.set(url, managedRelay);
          
          // Auto reconnect if enabled
          if (this.autoReconnect && (managedRelay.read || managedRelay.write)) {
            setTimeout(() => this.connectToRelay(url), 5000);
          }
        }
      });
      
      ndkRelay.on('error', () => {
        const managedRelay = this.relays.get(url);
        if (managedRelay) {
          managedRelay.status = 'error';
          this.relays.set(url, managedRelay);
        }
      });
      
      return true;
    } catch (error) {
      console.error(`Failed to connect to relay ${url}:`, error);
      
      const relay = this.relays.get(url);
      if (relay) {
        relay.status = 'error';
        this.relays.set(url, relay);
      }
      
      return false;
    }
  }
  
  /**
   * Disconnect from a specific relay
   */
  async disconnectFromRelay(url: string): Promise<boolean> {
    if (!this.ndk) {
      return false;
    }
    
    try {
      // Update status
      const relay = this.relays.get(url);
      if (relay) {
        relay.status = 'disconnected';
        this.relays.set(url, relay);
      }
      
      // Get relay from NDK pool
      const ndkRelay = this.ndk.pool.relays.get(url);
      if (ndkRelay) {
        // Disconnect the relay
        await ndkRelay.disconnect();
        // Remove from pool
        this.ndk.pool.relays.delete(url);
      }
      
      return true;
    } catch (error) {
      console.error(`Failed to disconnect from relay ${url}:`, error);
      return false;
    }
  }
  
  /**
   * Connect to all enabled relays
   */
  async connectToEnabledRelays(): Promise<void> {
    if (!this.ndk) {
      this.ndk = await getNDK();
    }
    
    const promises: Promise<boolean>[] = [];
    
    // Connect to all enabled relays using Array.from to avoid iterator issues
    Array.from(this.relays.keys()).forEach(url => {
      const relay = this.relays.get(url);
      if (relay && (relay.read || relay.write)) {
        promises.push(this.connectToRelay(url));
      }
    });
    
    await Promise.allSettled(promises);
  }
  
  /**
   * Measure latency of all connected relays
   */
  async measureRelayLatency(): Promise<void> {
    if (!this.ndk) {
      return;
    }
    
    // Use Array.from to avoid iterator issues
    Array.from(this.relays.keys()).forEach(async url => {
      const relay = this.relays.get(url);
      if (relay && relay.status === 'connected') {
        try {
          const startTime = Date.now();
          // Ping the relay (using a simple subscription to measure latency)
          const sub = this.ndk!.subscribe({ limit: 1 }, { relayUrls: [url] });
          
          const timeout = setTimeout(() => {
            sub.stop();
            if (relay) {
              relay.latency = -1; // Timeout
              this.relays.set(url, relay);
            }
          }, 5000);
          
          // Wait for EOSE (End Of Stored Events)
          await new Promise<void>(resolve => {
            sub.on('eose', () => {
              clearTimeout(timeout);
              const endTime = Date.now();
              if (relay) {
                relay.latency = endTime - startTime;
                this.relays.set(url, relay);
              }
              sub.stop();
              resolve();
            });
          });
        } catch (error) {
          console.error(`Failed to measure latency for relay ${url}:`, error);
          if (relay) {
            relay.latency = -1;
            this.relays.set(url, relay);
          }
        }
      }
    });
  }
  
  /**
   * Load relays from local storage
   */
  private loadRelays(): void {
    try {
      const storedRelays = localStorage.getItem(USER_RELAYS_KEY);
      if (storedRelays) {
        const parsedRelays = JSON.parse(storedRelays) as ManagedRelay[];
        // Reset all relay statuses to disconnected (they will be updated on connect)
        parsedRelays.forEach(relay => {
          relay.status = 'disconnected';
          this.relays.set(relay.url, relay);
        });
      }
    } catch (error) {
      console.error('Failed to load relays from storage:', error);
    }
  }
  
  /**
   * Save relays to local storage
   */
  private saveRelays(): void {
    try {
      localStorage.setItem(
        USER_RELAYS_KEY,
        JSON.stringify(Array.from(this.relays.values()))
      );
    } catch (error) {
      console.error('Failed to save relays to storage:', error);
    }
  }
  
  /**
   * Set auto reconnect
   */
  setAutoReconnect(enabled: boolean): void {
    this.autoReconnect = enabled;
  }
}

// Singleton instance
let relayManagerInstance: RelayManager | null = null;

/**
 * Get the relay manager instance
 */
export const getRelayManager = (): RelayManager => {
  if (!relayManagerInstance) {
    relayManagerInstance = new RelayManager();
  }
  return relayManagerInstance;
};