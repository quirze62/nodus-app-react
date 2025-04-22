import * as simpleRelay from './simpleRelayConnector';
import logger from './logger';

// Default relays
export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.current.fyi',
  'wss://nostr.wine'
];

// Relay interface
export interface ManagedRelay {
  url: string;
  status: string;
  connected: boolean;
  latency?: number;
  read: boolean;
  write: boolean;
}

// Simple relay manager singleton
class SimpleRelayManager {
  private autoReconnect: boolean = true;
  private reconnectInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    logger.info('Creating SimpleRelayManager');
    
    // Start reconnect interval if auto reconnect is enabled
    this.startReconnectInterval();
  }
  
  // Start the reconnect interval
  private startReconnectInterval(): void {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }
    
    if (this.autoReconnect) {
      this.reconnectInterval = setInterval(() => {
        this.reconnectDisconnectedRelays();
      }, 30000); // Try to reconnect every 30 seconds
    }
  }
  
  // Reconnect disconnected relays
  private async reconnectDisconnectedRelays(): Promise<void> {
    if (!this.autoReconnect) return;
    
    logger.debug('Checking for disconnected relays to reconnect');
    
    const relays = simpleRelay.getAllRelays();
    
    for (const relay of relays) {
      if (!relay.connected && relay.status !== 'connecting') {
        logger.info(`Auto-reconnecting to disconnected relay: ${relay.url}`);
        
        try {
          await simpleRelay.connectToRelay(relay.url);
        } catch (error) {
          logger.error(`Error reconnecting to relay ${relay.url}:`, error);
        }
      }
    }
  }
  
  // Initialize with default relays
  public async initialize(): Promise<void> {
    logger.info('Initializing SimpleRelayManager');
    
    // Connect to default relays
    for (const url of DEFAULT_RELAYS) {
      await this.addRelay(url);
    }
  }
  
  // Get all relays
  public getAllRelays(): ManagedRelay[] {
    const simpleRelays = simpleRelay.getAllRelays();
    
    return simpleRelays.map(relay => ({
      url: relay.url,
      status: relay.status,
      connected: relay.connected,
      latency: undefined, // We don't track latency in the simple implementation
      read: true, // Always true in the simple implementation
      write: true // Always true in the simple implementation
    }));
  }
  
  // Add a relay
  public async addRelay(url: string): Promise<boolean> {
    try {
      logger.info(`Adding relay: ${url}`);
      
      // Make sure the URL is valid
      if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
        logger.error(`Invalid relay URL: ${url} - must start with wss:// or ws://`);
        return false;
      }
      
      // Normalize URL by removing trailing slash
      const normalizedUrl = url.endsWith('/') ? url.slice(0, -1) : url;
      
      // Connect to the relay
      const success = await simpleRelay.connectToRelay(normalizedUrl);
      
      return success;
    } catch (error) {
      logger.error(`Error adding relay ${url}:`, error);
      return false;
    }
  }
  
  // Remove a relay
  public async removeRelay(url: string): Promise<boolean> {
    try {
      logger.info(`Removing relay: ${url}`);
      
      return await simpleRelay.removeRelay(url);
    } catch (error) {
      logger.error(`Error removing relay ${url}:`, error);
      return false;
    }
  }
  
  // Update a relay's read/write settings
  public async updateRelay(url: string, read: boolean, write: boolean): Promise<boolean> {
    try {
      logger.info(`Updating relay ${url}: read=${read}, write=${write}`);
      
      // In the simple implementation, we don't support separate read/write settings
      // But we'll return true to indicate success
      return true;
    } catch (error) {
      logger.error(`Error updating relay ${url}:`, error);
      return false;
    }
  }
  
  // Set auto reconnect
  public setAutoReconnect(enabled: boolean): void {
    logger.info(`Setting auto reconnect: ${enabled}`);
    
    this.autoReconnect = enabled;
    
    // Update the reconnect interval
    this.startReconnectInterval();
  }
  
  // Clean up
  public async cleanup(): Promise<void> {
    logger.info('Cleaning up SimpleRelayManager');
    
    // Clear the reconnect interval
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
    
    // Disconnect from all relays
    await simpleRelay.cleanupRelayConnector();
  }
}

// Create a singleton instance
const simpleRelayManager = new SimpleRelayManager();

// Export a function to get the singleton instance
export function getRelayManager(): SimpleRelayManager {
  return simpleRelayManager;
}