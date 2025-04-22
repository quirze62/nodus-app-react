import logger from './logger';
import { NostrEvent } from './nostr';

// Simple relay interface that doesn't rely on NDK
export interface SimpleRelay {
  url: string;
  socket: WebSocket | null;
  connected: boolean;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastError: string | null;
  eventHandlers: {
    message: ((event: NostrEvent) => void)[];
    connect: (() => void)[];
    disconnect: (() => void)[];
    error: ((error: any) => void)[];
  };
}

const relays = new Map<string, SimpleRelay>();

// Get all relays
export const getAllRelays = (): SimpleRelay[] => {
  return Array.from(relays.values());
};

// Get a relay by URL
export const getRelay = (url: string): SimpleRelay | undefined => {
  return relays.get(url);
};

// Create a relay
export const createRelay = (url: string): SimpleRelay => {
  if (relays.has(url)) {
    return relays.get(url)!;
  }
  
  const relay: SimpleRelay = {
    url,
    socket: null,
    connected: false,
    status: 'disconnected',
    lastError: null,
    eventHandlers: {
      message: [],
      connect: [],
      disconnect: [],
      error: []
    }
  };
  
  relays.set(url, relay);
  return relay;
};

// Connect to a relay
export const connectToRelay = async (url: string): Promise<boolean> => {
  try {
    logger.info(`Connecting to relay: ${url}`);
    
    let relay = relays.get(url);
    if (!relay) {
      relay = createRelay(url);
    }
    
    // Already connected
    if (relay.connected && relay.socket?.readyState === WebSocket.OPEN) {
      logger.info(`Already connected to relay: ${url}`);
      return true;
    }
    
    // Close existing socket if any
    if (relay.socket) {
      try {
        relay.socket.close();
      } catch (err) {
        logger.error(`Error closing existing socket for ${url}:`, err);
      }
    }
    
    relay.status = 'connecting';
    relay.connected = false;
    relay.lastError = null;
    
    // Create a new WebSocket
    const socket = new WebSocket(url);
    relay.socket = socket;
    
    return new Promise<boolean>((resolve, reject) => {
      // Timeout after 10 seconds
      const timeoutId = setTimeout(() => {
        relay!.status = 'error';
        relay!.lastError = 'Connection timeout';
        logger.error(`Connection timeout for ${url}`);
        reject(new Error(`Connection timeout for ${url}`));
      }, 10000);
      
      socket.onopen = () => {
        clearTimeout(timeoutId);
        logger.info(`Connected to relay: ${url}`);
        relay!.status = 'connected';
        relay!.connected = true;
        
        // Call connect handlers
        relay!.eventHandlers.connect.forEach(handler => {
          try {
            handler();
          } catch (err) {
            logger.error(`Error in connect handler for ${url}:`, err);
          }
        });
        
        resolve(true);
      };
      
      socket.onclose = () => {
        clearTimeout(timeoutId);
        logger.info(`Disconnected from relay: ${url}`);
        relay!.status = 'disconnected';
        relay!.connected = false;
        
        // Call disconnect handlers
        relay!.eventHandlers.disconnect.forEach(handler => {
          try {
            handler();
          } catch (err) {
            logger.error(`Error in disconnect handler for ${url}:`, err);
          }
        });
        
        // Only reject if we haven't already resolved
        if (relay!.status === 'connecting') {
          reject(new Error(`Connection closed unexpectedly for ${url}`));
        }
      };
      
      socket.onerror = (error) => {
        clearTimeout(timeoutId);
        logger.error(`Error with relay ${url}:`, error);
        relay!.status = 'error';
        relay!.lastError = 'WebSocket error';
        relay!.connected = false;
        
        // Call error handlers
        relay!.eventHandlers.error.forEach(handler => {
          try {
            handler(error);
          } catch (err) {
            logger.error(`Error in error handler for ${url}:`, err);
          }
        });
        
        reject(error);
      };
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Check if it's a valid Nostr message
          if (Array.isArray(data) && data.length >= 2) {
            const messageType = data[0];
            
            if (messageType === 'EVENT' && data.length >= 3) {
              const nostrEvent = data[2];
              
              // Call message handlers
              relay!.eventHandlers.message.forEach(handler => {
                try {
                  handler(nostrEvent);
                } catch (err) {
                  logger.error(`Error in message handler for ${url}:`, err);
                }
              });
            }
          }
        } catch (err) {
          logger.error(`Error parsing message from ${url}:`, err);
        }
      };
    });
  } catch (error) {
    logger.error(`Error connecting to relay ${url}:`, error);
    
    // Update relay status
    const relay = relays.get(url);
    if (relay) {
      relay.status = 'error';
      relay.connected = false;
      relay.lastError = error instanceof Error ? error.message : String(error);
    }
    
    return false;
  }
};

// Disconnect from a relay
export const disconnectFromRelay = async (url: string): Promise<boolean> => {
  try {
    logger.info(`Disconnecting from relay: ${url}`);
    
    const relay = relays.get(url);
    if (!relay) {
      logger.warn(`Relay not found: ${url}`);
      return false;
    }
    
    if (relay.socket) {
      try {
        relay.socket.close();
        relay.socket = null;
      } catch (err) {
        logger.error(`Error closing socket for ${url}:`, err);
      }
    }
    
    relay.status = 'disconnected';
    relay.connected = false;
    
    return true;
  } catch (error) {
    logger.error(`Error disconnecting from relay ${url}:`, error);
    return false;
  }
};

// Remove a relay
export const removeRelay = async (url: string): Promise<boolean> => {
  try {
    logger.info(`Removing relay: ${url}`);
    
    await disconnectFromRelay(url);
    relays.delete(url);
    
    return true;
  } catch (error) {
    logger.error(`Error removing relay ${url}:`, error);
    return false;
  }
};

// Add event handler
export const addEventHandler = (
  url: string,
  eventType: 'message' | 'connect' | 'disconnect' | 'error',
  handler: any
): boolean => {
  try {
    const relay = relays.get(url);
    if (!relay) {
      logger.warn(`Relay not found: ${url}`);
      return false;
    }
    
    relay.eventHandlers[eventType].push(handler);
    return true;
  } catch (error) {
    logger.error(`Error adding event handler for ${url}:`, error);
    return false;
  }
};

// Remove event handler
export const removeEventHandler = (
  url: string,
  eventType: 'message' | 'connect' | 'disconnect' | 'error',
  handler: any
): boolean => {
  try {
    const relay = relays.get(url);
    if (!relay) {
      logger.warn(`Relay not found: ${url}`);
      return false;
    }
    
    const handlers = relay.eventHandlers[eventType];
    const index = handlers.indexOf(handler);
    
    if (index !== -1) {
      handlers.splice(index, 1);
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error(`Error removing event handler for ${url}:`, error);
    return false;
  }
};

// Send a request to a relay
export const sendRequest = async (
  url: string,
  requestType: string,
  data: any
): Promise<boolean> => {
  try {
    logger.debug(`Sending ${requestType} request to ${url}:`, data);
    
    const relay = relays.get(url);
    if (!relay) {
      logger.warn(`Relay not found: ${url}`);
      return false;
    }
    
    if (!relay.connected || !relay.socket || relay.socket.readyState !== WebSocket.OPEN) {
      logger.warn(`Not connected to relay: ${url}`);
      return false;
    }
    
    // Format the message based on request type
    let message;
    
    switch (requestType) {
      case 'EVENT':
        message = ['EVENT', data];
        break;
      case 'REQ':
        const requestId = Math.random().toString(36).substring(2, 15);
        message = ['REQ', requestId, data];
        break;
      case 'CLOSE':
        const closeId = data.id || Math.random().toString(36).substring(2, 15);
        message = ['CLOSE', closeId];
        break;
      default:
        logger.warn(`Unknown request type: ${requestType}`);
        return false;
    }
    
    // Send the message
    relay.socket.send(JSON.stringify(message));
    return true;
  } catch (error) {
    logger.error(`Error sending ${requestType} request to ${url}:`, error);
    return false;
  }
};

// Initialize the relay connector
export const initializeRelayConnector = (): void => {
  logger.info('Initializing simple relay connector');
  
  // Add any initialization logic here
};

// Clean up the relay connector
export const cleanupRelayConnector = async (): Promise<void> => {
  logger.info('Cleaning up simple relay connector');
  
  // Disconnect from all relays
  const urls = Array.from(relays.keys());
  for (const url of urls) {
    await disconnectFromRelay(url);
  }
  
  // Clear the relays map
  relays.clear();
};