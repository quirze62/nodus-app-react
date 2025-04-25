import React, { createContext, useState, useEffect, useMemo, useContext } from 'react';
import NDK, { NDKNip07Signer, NDKPrivateKeySigner, NDKRelay, NDKRelaySet } from '@nostr-dev-kit/ndk';
import logger from '../lib/logger';
import { db } from '../lib/db';
import { NostrUser } from '../lib/nostr';

// List of reliable relays
export const DEFAULT_RELAYS = [
  'wss://relay.mynodus.com',
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band', 
  'wss://nostr.wine'
];

// NDK context
export const NdkContext = createContext<NDK | null>(null);

// Hook to use NDK
export const useNDK = () => {
  const ndk = useContext(NdkContext);
  if (!ndk) {
    throw new Error('useNDK must be used within a NodusProvider');
  }
  return ndk;
};

// User context for global user state
interface UserContextType {
  user: NostrUser | null;
  setUser: (user: NostrUser | null) => void;
  loginWithPrivateKey: (privateKey: string) => Promise<NostrUser>;
  generateNewUser: () => Promise<NostrUser>;
  logout: () => void;
}

export const UserContext = createContext<UserContextType>({
  user: null,
  setUser: () => {},
  loginWithPrivateKey: async () => { throw new Error('UserContext not initialized'); },
  generateNewUser: async () => { throw new Error('UserContext not initialized'); },
  logout: () => {},
});

// Hook to use User context
export const useNodusUser = () => useContext(UserContext);

// Main NDK provider component that wraps the entire app
export const NodusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ndk, setNdk] = useState<NDK | null>(null);
  const [user, setUser] = useState<NostrUser | null>(null);
  const [initialized, setInitialized] = useState(false);
  
  // Initialize NDK and load cached user
  useEffect(() => {
    const initNdk = async () => {
      logger.info('Initializing NDK');
      
      // Create NDK instance
      const ndkInstance = new NDK({
        explicitRelayUrls: DEFAULT_RELAYS,
        enableOutboxModel: true,
      });
      
      try {
        // Connect to relays
        logger.info('Connecting to relays');
        await ndkInstance.connect();
        
        // Log connected relays
        const connectedRelays = Array.from(ndkInstance.pool.relays.values())
          .filter(relay => relay.connected)
          .map(relay => relay.url);
          
        logger.info(`Connected to ${connectedRelays.length} NDK relays: ${connectedRelays.join(', ')}`);
        
        // Try to load cached user
        const cachedUser = await db.getCurrentUser();
        if (cachedUser && cachedUser.privateKey) {
          logger.info('Found cached user, setting up signer');
          try {
            const signer = new NDKPrivateKeySigner(cachedUser.privateKey);
            ndkInstance.signer = signer;
            setUser(cachedUser);
          } catch (err) {
            logger.error('Error setting up signer with cached user', err);
          }
        }
        
        setNdk(ndkInstance);
        setInitialized(true);
      } catch (err) {
        logger.error('Error initializing NDK', err);
      }
    };
    
    initNdk();
    
    // Cleanup
    return () => {
      logger.info('NDK Provider cleanup');
    };
  }, []);
  
  // Login with private key
  const loginWithPrivateKey = async (privateKey: string): Promise<NostrUser> => {
    if (!ndk) throw new Error('NDK not initialized');
    
    try {
      logger.info('Logging in with private key');
      
      // Create signer and set it on NDK
      const signer = new NDKPrivateKeySigner(privateKey);
      ndk.signer = signer;
      
      // Get user from signer
      const ndkUser = await signer.user();
      
      // Create our user object
      const nostrUser: NostrUser = {
        publicKey: ndkUser.pubkey,
        privateKey: privateKey,
        npub: ndkUser.npub,
        nsec: privateKey, // In a real app, this would be properly formatted
      };
      
      // Store user in database
      await db.storeCurrentUser(nostrUser);
      
      // Update state
      setUser(nostrUser);
      
      return nostrUser;
    } catch (err) {
      logger.error('Error logging in with private key', err);
      throw new Error('Failed to login with private key');
    }
  };
  
  // Generate a new user with random keypair
  const generateNewUser = async (): Promise<NostrUser> => {
    if (!ndk) throw new Error('NDK not initialized');
    
    try {
      logger.info('Generating new user');
      
      // Generate random private key
      const privateKey = window.crypto.getRandomValues(new Uint8Array(32));
      const privateKeyHex = Array.from(privateKey)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      // Create signer with the new key
      const signer = new NDKPrivateKeySigner(privateKeyHex);
      ndk.signer = signer;
      
      // Get user from signer
      const ndkUser = await signer.user();
      
      // Create our user object
      const nostrUser: NostrUser = {
        publicKey: ndkUser.pubkey,
        privateKey: privateKeyHex,
        npub: ndkUser.npub,
        nsec: privateKeyHex, // In a real app, this would be properly formatted
      };
      
      // Store user in database
      await db.storeCurrentUser(nostrUser);
      
      // Update state
      setUser(nostrUser);
      
      return nostrUser;
    } catch (err) {
      logger.error('Error generating new user', err);
      throw new Error('Failed to generate new user');
    }
  };
  
  // Logout
  const logout = async () => {
    logger.info('Logging out');
    
    if (ndk) {
      ndk.signer = undefined;
    }
    
    // Clear user from state
    setUser(null);
    
    // Clear from database
    await db.clearCurrentUser();
  };
  
  // User context value
  const userContextValue = useMemo(() => ({
    user,
    setUser,
    loginWithPrivateKey,
    generateNewUser,
    logout,
  }), [user, ndk]);
  
  // Only render children when NDK is initialized
  if (!initialized || !ndk) {
    return <div>Connecting to Nostr network...</div>;
  }
  
  // Provide both NDK and user context
  return (
    <NdkContext.Provider value={ndk}>
      <UserContext.Provider value={userContextValue}>
        {children}
      </UserContext.Provider>
    </NdkContext.Provider>
  );
};