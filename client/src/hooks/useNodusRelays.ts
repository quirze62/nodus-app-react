import { useState, useEffect, useCallback } from 'react';
import { useNDK } from '@nostr-dev-kit/ndk-hooks';
import { NDKRelay } from '@nostr-dev-kit/ndk';
import logger from '../lib/logger';

// Type for relay info
interface RelayInfo {
  url: string;
  connected: boolean;
}

export function useNodusRelays() {
  const { ndk } = useNDK();
  const [relays, setRelays] = useState<RelayInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get relay status
  const getRelayStatus = useCallback(async () => {
    if (!ndk) {
      setError('NDK not initialized');
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      
      const relayInfos = Array.from(ndk.pool.relays.values()).map(relay => ({
        url: relay.url,
        connected: relay.connected
      }));
      
      setRelays(relayInfos);
      setError(null);
    } catch (err) {
      logger.error('Error getting relay status', err);
      setError('Failed to get relay status');
    } finally {
      setIsLoading(false);
    }
  }, [ndk]);
  
  // Load relay status when NDK changes
  useEffect(() => {
    if (ndk) {
      getRelayStatus();
    }
  }, [ndk, getRelayStatus]);
  
  // Add a relay
  const addRelay = async (url: string): Promise<boolean> => {
    if (!ndk) {
      setError('NDK not initialized');
      return false;
    }
    
    try {
      logger.info(`Adding relay: ${url}`);
      
      // Create relay object
      const relay = new NDKRelay(url);
      
      // Add to pool
      ndk.pool.addRelay(relay);
      
      // Try to connect
      await relay.connect();
      
      // Refresh relay list
      await getRelayStatus();
      
      return relay.connected;
    } catch (err) {
      logger.error(`Error adding relay ${url}`, err);
      setError(`Failed to add relay ${url}`);
      return false;
    }
  };
  
  // Remove a relay
  const removeRelay = async (url: string): Promise<boolean> => {
    if (!ndk) {
      setError('NDK not initialized');
      return false;
    }
    
    try {
      logger.info(`Removing relay: ${url}`);
      
      // Find the relay
      const relay = ndk.pool.relays.get(url);
      
      if (!relay) {
        logger.warn(`Relay ${url} not found`);
        return false;
      }
      
      // Disconnect
      await relay.disconnect();
      
      // Remove from pool
      ndk.pool.removeRelay(relay);
      
      // Refresh relay list
      await getRelayStatus();
      
      return true;
    } catch (err) {
      logger.error(`Error removing relay ${url}`, err);
      setError(`Failed to remove relay ${url}`);
      return false;
    }
  };
  
  return {
    relays,
    isLoading,
    error,
    refreshRelays: getRelayStatus,
    addRelay,
    removeRelay
  };
}