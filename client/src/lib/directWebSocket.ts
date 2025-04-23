import logger from './logger';

/**
 * DirectRelay represents a direct WebSocket connection to a Nostr relay
 */
export interface DirectRelay {
  url: string;
  socket: WebSocket | null;
  connected: boolean;
  subscriptions: Map<string, SubscriptionHandler>;
}

/**
 * Subscription handler for events from a relay
 */
export interface SubscriptionHandler {
  id: string;
  filters: any;
  onEvent: (event: any) => void;
  onEose?: () => void;
}

/**
 * DirectWebSocketManager provides raw WebSocket connections to Nostr relays
 * to bypass NDK when necessary for more reliable connections
 */
export class DirectWebSocketManager {
  private relays: Map<string, DirectRelay> = new Map();
  private reconnectTimers: Map<string, number> = new Map();
  private autoReconnect: boolean = true;
  private reconnectInterval: number = 10000; // 10 seconds
  
  /**
   * Connect to a Nostr relay via WebSocket
   */
  async connectToRelay(url: string): Promise<boolean> {
    try {
      logger.info(`[DirectWS] Connecting to relay: ${url}`);
      
      // If already connected, return success
      if (this.relays.has(url) && this.relays.get(url)?.connected) {
        logger.info(`[DirectWS] Already connected to ${url}`);
        return true;
      }
      
      // Initialize relay object if it doesn't exist
      if (!this.relays.has(url)) {
        this.relays.set(url, {
          url,
          socket: null,
          connected: false,
          subscriptions: new Map()
        });
      }
      
      const relay = this.relays.get(url)!;
      
      // Close existing socket if it exists
      if (relay.socket) {
        relay.socket.onclose = null; // Remove event handlers
        relay.socket.onerror = null;
        relay.socket.onmessage = null;
        relay.socket.onopen = null;
        relay.socket.close();
        relay.socket = null;
      }
      
      // Create new WebSocket connection
      const socket = new WebSocket(url);
      relay.socket = socket;
      
      return new Promise<boolean>((resolve) => {
        // Set timeout for connection
        const timeout = setTimeout(() => {
          logger.error(`[DirectWS] Connection timeout for ${url}`);
          resolve(false);
        }, 5000);
        
        // Handle successful connection
        socket.onopen = () => {
          logger.info(`[DirectWS] Connected to ${url}`);
          clearTimeout(timeout);
          
          relay.connected = true;
          
          // If we have any active subscriptions, re-subscribe
          relay.subscriptions.forEach((sub) => {
            this.sendSubscribeMessage(url, sub.id, sub.filters);
          });
          
          resolve(true);
        };
        
        // Handle connection errors
        socket.onerror = (error) => {
          logger.error(`[DirectWS] Error connecting to ${url}:`, error);
          clearTimeout(timeout);
          relay.connected = false;
          
          // Setup reconnect if enabled
          if (this.autoReconnect && !this.reconnectTimers.has(url)) {
            this.setupReconnect(url);
          }
          
          resolve(false);
        };
        
        // Handle connection close
        socket.onclose = () => {
          logger.info(`[DirectWS] Connection closed for ${url}`);
          relay.connected = false;
          
          // Setup reconnect if enabled
          if (this.autoReconnect && !this.reconnectTimers.has(url)) {
            this.setupReconnect(url);
          }
        };
        
        // Handle incoming messages
        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleRelayMessage(url, data);
          } catch (error) {
            logger.error(`[DirectWS] Error parsing message from ${url}:`, error);
          }
        };
      });
    } catch (error) {
      logger.error(`[DirectWS] Error in connectToRelay ${url}:`, error);
      return false;
    }
  }
  
  /**
   * Disconnect from a relay
   */
  disconnectFromRelay(url: string): boolean {
    try {
      logger.info(`[DirectWS] Disconnecting from relay: ${url}`);
      
      if (!this.relays.has(url)) {
        return false;
      }
      
      const relay = this.relays.get(url)!;
      
      // Clear any reconnect timer
      if (this.reconnectTimers.has(url)) {
        clearTimeout(this.reconnectTimers.get(url));
        this.reconnectTimers.delete(url);
      }
      
      // Close socket if it exists
      if (relay.socket) {
        relay.socket.onclose = null; // Remove event handlers
        relay.socket.onerror = null;
        relay.socket.onmessage = null;
        relay.socket.onopen = null;
        relay.socket.close();
        relay.socket = null;
      }
      
      relay.connected = false;
      
      return true;
    } catch (error) {
      logger.error(`[DirectWS] Error disconnecting from ${url}:`, error);
      return false;
    }
  }
  
  /**
   * Subscribe to events from a relay
   */
  subscribe(url: string, filters: any, onEvent: (event: any) => void, onEose?: () => void): string {
    try {
      // Generate a random subscription ID
      const subId = Math.random().toString(36).substring(2, 15);
      
      logger.info(`[DirectWS] Creating subscription ${subId} on ${url}`);
      
      // Make sure relay exists and is connected
      if (!this.relays.has(url)) {
        // Try to connect first
        this.connectToRelay(url);
      }
      
      const relay = this.relays.get(url)!;
      
      // Store subscription handler
      relay.subscriptions.set(subId, {
        id: subId,
        filters,
        onEvent,
        onEose
      });
      
      // If connected, send subscription request
      if (relay.connected && relay.socket) {
        this.sendSubscribeMessage(url, subId, filters);
      }
      
      return subId;
    } catch (error) {
      logger.error(`[DirectWS] Error creating subscription on ${url}:`, error);
      return "";
    }
  }
  
  /**
   * Unsubscribe from events
   */
  unsubscribe(url: string, subId: string): boolean {
    try {
      logger.info(`[DirectWS] Unsubscribing ${subId} from ${url}`);
      
      if (!this.relays.has(url)) {
        return false;
      }
      
      const relay = this.relays.get(url)!;
      
      // Remove subscription
      relay.subscriptions.delete(subId);
      
      // Send unsubscribe message if connected
      if (relay.connected && relay.socket) {
        this.sendUnsubscribeMessage(url, subId);
      }
      
      return true;
    } catch (error) {
      logger.error(`[DirectWS] Error unsubscribing ${subId} from ${url}:`, error);
      return false;
    }
  }
  
  /**
   * Publish an event to a relay
   */
  publishEvent(url: string, event: any): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      try {
        logger.info(`[DirectWS] Publishing event to ${url}`);
        
        if (!this.relays.has(url)) {
          // Try to connect first
          this.connectToRelay(url).then((connected) => {
            if (connected) {
              this.sendPublishMessage(url, event);
              resolve(true);
            } else {
              resolve(false);
            }
          });
          return;
        }
        
        const relay = this.relays.get(url)!;
        
        if (!relay.connected || !relay.socket) {
          // Try to reconnect
          this.connectToRelay(url).then((connected) => {
            if (connected) {
              this.sendPublishMessage(url, event);
              resolve(true);
            } else {
              resolve(false);
            }
          });
          return;
        }
        
        // Send event directly
        this.sendPublishMessage(url, event);
        resolve(true);
      } catch (error) {
        logger.error(`[DirectWS] Error publishing event to ${url}:`, error);
        resolve(false);
      }
    });
  }
  
  /**
   * Send a REQ message to subscribe to events
   */
  private sendSubscribeMessage(url: string, subId: string, filters: any): boolean {
    try {
      if (!this.relays.has(url)) {
        return false;
      }
      
      const relay = this.relays.get(url)!;
      
      if (!relay.connected || !relay.socket) {
        return false;
      }
      
      // Format REQ message: ["REQ", <subscription_id>, <filter>]
      const reqMessage = ["REQ", subId, filters];
      
      // Send to relay
      relay.socket.send(JSON.stringify(reqMessage));
      logger.info(`[DirectWS] Sent subscription ${subId} to ${url}`);
      
      return true;
    } catch (error) {
      logger.error(`[DirectWS] Error sending subscription to ${url}:`, error);
      return false;
    }
  }
  
  /**
   * Send a CLOSE message to unsubscribe
   */
  private sendUnsubscribeMessage(url: string, subId: string): boolean {
    try {
      if (!this.relays.has(url)) {
        return false;
      }
      
      const relay = this.relays.get(url)!;
      
      if (!relay.connected || !relay.socket) {
        return false;
      }
      
      // Format CLOSE message: ["CLOSE", <subscription_id>]
      const closeMessage = ["CLOSE", subId];
      
      // Send to relay
      relay.socket.send(JSON.stringify(closeMessage));
      logger.info(`[DirectWS] Sent unsubscribe ${subId} to ${url}`);
      
      return true;
    } catch (error) {
      logger.error(`[DirectWS] Error sending unsubscribe to ${url}:`, error);
      return false;
    }
  }
  
  /**
   * Send an EVENT message to publish an event
   */
  private sendPublishMessage(url: string, event: any): boolean {
    try {
      if (!this.relays.has(url)) {
        return false;
      }
      
      const relay = this.relays.get(url)!;
      
      if (!relay.connected || !relay.socket) {
        return false;
      }
      
      // Format EVENT message: ["EVENT", <event>]
      const eventMessage = ["EVENT", event];
      
      // Send to relay
      relay.socket.send(JSON.stringify(eventMessage));
      logger.info(`[DirectWS] Sent event ${event.id} to ${url}`);
      
      return true;
    } catch (error) {
      logger.error(`[DirectWS] Error sending event to ${url}:`, error);
      return false;
    }
  }
  
  /**
   * Handle messages from relays
   */
  private handleRelayMessage(url: string, data: any[]): void {
    try {
      if (!data || !Array.isArray(data) || data.length < 2) {
        return;
      }
      
      const messageType = data[0];
      
      if (messageType === "EVENT" && data.length >= 3) {
        // EVENT message: ["EVENT", <subscription_id>, <event>]
        const subId = data[1];
        const event = data[2];
        
        if (!this.relays.has(url)) {
          return;
        }
        
        const relay = this.relays.get(url)!;
        const subscription = relay.subscriptions.get(subId);
        
        if (subscription) {
          // Pass event to subscription handler
          subscription.onEvent(event);
        }
      } else if (messageType === "EOSE" && data.length >= 2) {
        // EOSE message: ["EOSE", <subscription_id>]
        const subId = data[1];
        
        if (!this.relays.has(url)) {
          return;
        }
        
        const relay = this.relays.get(url)!;
        const subscription = relay.subscriptions.get(subId);
        
        if (subscription && subscription.onEose) {
          // Call EOSE handler
          subscription.onEose();
        }
      } else if (messageType === "OK" && data.length >= 3) {
        // OK message: ["OK", <event_id>, <accepted>]
        const eventId = data[1];
        const accepted = data[2];
        
        logger.info(`[DirectWS] Received OK for event ${eventId} from ${url}: ${accepted}`);
      } else if (messageType === "NOTICE" && data.length >= 2) {
        // NOTICE message: ["NOTICE", <message>]
        const message = data[1];
        
        logger.info(`[DirectWS] Received NOTICE from ${url}: ${message}`);
      }
    } catch (error) {
      logger.error(`[DirectWS] Error handling message from ${url}:`, error);
    }
  }
  
  /**
   * Setup reconnect timer for a relay
   */
  private setupReconnect(url: string): void {
    if (this.reconnectTimers.has(url)) {
      clearTimeout(this.reconnectTimers.get(url));
    }
    
    logger.info(`[DirectWS] Setting up reconnect for ${url} in ${this.reconnectInterval}ms`);
    
    const timerId = window.setTimeout(() => {
      logger.info(`[DirectWS] Attempting to reconnect to ${url}`);
      this.reconnectTimers.delete(url);
      this.connectToRelay(url);
    }, this.reconnectInterval);
    
    this.reconnectTimers.set(url, timerId);
  }
  
  /**
   * Set auto reconnect behavior
   */
  setAutoReconnect(enabled: boolean): void {
    this.autoReconnect = enabled;
    
    // If disabled, clear all reconnect timers
    if (!enabled) {
      this.reconnectTimers.forEach((timerId) => {
        clearTimeout(timerId);
      });
      this.reconnectTimers.clear();
    }
  }
  
  /**
   * Get connection status for all relays
   */
  getRelayStatus(): { url: string, connected: boolean }[] {
    return Array.from(this.relays.values()).map((relay) => ({
      url: relay.url,
      connected: relay.connected
    }));
  }
  
  /**
   * Create a multi-relay subscription to gather events
   */
  async queryRelays(
    relayUrls: string[],
    filters: any,
    timeoutMs: number = 3000
  ): Promise<any[]> {
    return new Promise<any[]>((resolve) => {
      // First ensure we're connected to all relays
      const connectionPromises = relayUrls.map(url => this.connectToRelay(url));
      
      Promise.allSettled(connectionPromises).then(() => {
        const events: any[] = [];
        const subIds: string[] = [];
        
        // Track when we've received EOSE from all relays
        let eoseCount = 0;
        
        // Set timeout
        const timeoutId = setTimeout(() => {
          logger.info(`[DirectWS] Query timeout after ${timeoutMs}ms, got ${events.length} events`);
          
          // Clean up subscriptions
          for (let i = 0; i < relayUrls.length; i++) {
            if (subIds[i]) {
              this.unsubscribe(relayUrls[i], subIds[i]);
            }
          }
          
          // Deduplicate events by ID
          const uniqueEvents = this.deduplicateEvents(events);
          resolve(uniqueEvents);
        }, timeoutMs);
        
        // Subscribe to each relay
        for (let i = 0; i < relayUrls.length; i++) {
          const url = relayUrls[i];
          
          // Create subscription
          const subId = this.subscribe(
            url,
            filters,
            (event) => {
              // Ensure we don't have duplicate events
              if (!events.some(e => e.id === event.id)) {
                events.push(event);
              }
            },
            () => {
              // EOSE handler
              eoseCount++;
              logger.info(`[DirectWS] Received EOSE from ${url}, ${eoseCount}/${relayUrls.length}`);
              
              // If we've received EOSE from all connected relays, we're done
              if (eoseCount === relayUrls.length) {
                logger.info(`[DirectWS] All relays sent EOSE, got ${events.length} events`);
                clearTimeout(timeoutId);
                
                // Clean up subscriptions
                for (let j = 0; j < relayUrls.length; j++) {
                  if (subIds[j]) {
                    this.unsubscribe(relayUrls[j], subIds[j]);
                  }
                }
                
                // Deduplicate events by ID
                const uniqueEvents = this.deduplicateEvents(events);
                resolve(uniqueEvents);
              }
            }
          );
          
          subIds.push(subId);
        }
      });
    });
  }
  
  /**
   * Deduplicate events by ID
   */
  private deduplicateEvents(events: any[]): any[] {
    const uniqueEvents = [];
    const eventIds = new Set();
    
    for (const event of events) {
      if (!eventIds.has(event.id)) {
        eventIds.add(event.id);
        uniqueEvents.push(event);
      }
    }
    
    return uniqueEvents;
  }
}

// Singleton instance
let directWSManager: DirectWebSocketManager | null = null;

/**
 * Get the direct WebSocket manager instance
 */
export const getDirectWSManager = (): DirectWebSocketManager => {
  if (!directWSManager) {
    directWSManager = new DirectWebSocketManager();
  }
  return directWSManager;
};