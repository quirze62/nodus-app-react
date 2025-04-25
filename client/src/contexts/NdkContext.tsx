import React, { createContext, useContext, useEffect, useState } from 'react';
import NDK, { NDKNip07Signer, NDKPrivateKeySigner, NDKUser, NDKEvent, NDKFilter, NDKSubscription, NDKRelay } from '@nostr-dev-kit/ndk';
import logger from '../lib/logger';
import { NostrEvent, NostrProfile, NostrUser } from '../lib/nostr';
import { db } from '../lib/db';

// Define our context type
interface NdkContextType {
  ndk: NDK | null;
  user: NostrUser | null;
  initialized: boolean;
  connecting: boolean;
  error: string | null;
  loginWithPrivateKey: (privateKey: string) => Promise<NostrUser>;
  generateNewUser: () => Promise<NostrUser>;
  logout: () => void;
  fetchNotes: (limit?: number) => Promise<NostrEvent[]>;
  publishNote: (content: string, tags?: string[][]) => Promise<NostrEvent | null>;
  fetchUserProfile: (pubkey: string) => Promise<NostrProfile | undefined>;
  updateUserProfile: (profile: NostrProfile) => Promise<boolean>;
  sendMessage: (receiverPubkey: string, content: string) => Promise<NostrEvent | null>;
  fetchMessages: (otherPubkey: string) => Promise<NostrEvent[]>;
  subscribeToNotes: (
    onEvent: (event: NostrEvent) => void,
    onEose?: () => void,
    filter?: { authors?: string[], kinds?: number[] }
  ) => () => void;
  getRelayStatus: () => Promise<{url: string, connected: boolean}[]>;
  addRelay: (url: string) => Promise<boolean>;
  removeRelay: (url: string) => Promise<boolean>;
}

// Create the context with default values
const NdkContext = createContext<NdkContextType>({
  ndk: null,
  user: null,
  initialized: false,
  connecting: false,
  error: null,
  loginWithPrivateKey: async () => { throw new Error('NdkProvider not initialized'); },
  generateNewUser: async () => { throw new Error('NdkProvider not initialized'); },
  logout: () => {},
  fetchNotes: async () => [],
  publishNote: async () => null,
  fetchUserProfile: async () => undefined,
  updateUserProfile: async () => false,
  sendMessage: async () => null,
  fetchMessages: async () => [],
  subscribeToNotes: () => () => {},
  getRelayStatus: async () => [],
  addRelay: async () => false,
  removeRelay: async () => false,
});

// List of reliable Nostr relays
const DEFAULT_RELAYS = [
  'wss://relay.mynodus.com',
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://nostr.wine'
];

export const NDK_EVENT_KIND = {
  METADATA: 0,
  TEXT_NOTE: 1,
  RECOMMEND_RELAY: 2,
  CONTACTS: 3,
  ENCRYPTED_DIRECT_MESSAGE: 4,
  DELETE: 5,
  REPOST: 6,
  REACTION: 7,
  BADGE_AWARD: 8,
  CHANNEL_CREATION: 40,
  CHANNEL_METADATA: 41,
  CHANNEL_MESSAGE: 42,
  CHANNEL_HIDE_MESSAGE: 43,
  CHANNEL_MUTE_USER: 44,
  PUBLIC_CHAT: 9734,
  REPORTING: 1984,
  LONG_FORM_CONTENT: 30023,
};

// Provider component that makes NDK data available to any child component
export const NdkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ndk, setNdk] = useState<NDK | null>(null);
  const [user, setUser] = useState<NostrUser | null>(null);
  const [initialized, setInitialized] = useState<boolean>(false);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize NDK when the component mounts
  useEffect(() => {
    const initializeNdk = async () => {
      try {
        setConnecting(true);
        setError(null);
        
        // Create a new NDK instance
        logger.info('Creating new NDK instance');
        const ndkInstance = new NDK({ 
          explicitRelayUrls: DEFAULT_RELAYS,
          enableOutboxModel: true 
        });
        
        // Connect to relays
        logger.info('Connecting to relays');
        await ndkInstance.connect();
        
        // Log connected relays
        const connectedRelays = Array.from(ndkInstance.pool.relays.values())
          .filter((relay: any) => relay.connected)
          .map((relay: any) => relay.url);
          
        logger.info(`Connected to ${connectedRelays.length} NDK relays: ${connectedRelays.join(', ')}`);
        
        // Load cached user from Dexie if available
        const cachedUser = await db.getCurrentUser();
        if (cachedUser) {
          logger.info('Found cached user');
          try {
            // Set up the signer with the cached private key
            const signer = new NDKPrivateKeySigner(cachedUser.privateKey);
            ndkInstance.signer = signer;
            setUser(cachedUser);
          } catch (signerError) {
            logger.error('Error setting up signer with cached credentials', signerError);
          }
        }
        
        setNdk(ndkInstance);
        setInitialized(true);
      } catch (initError) {
        logger.error('Error initializing NDK', initError);
        setError('Failed to initialize Nostr connection');
      } finally {
        setConnecting(false);
      }
    };
    
    initializeNdk();
    
    // Cleanup function
    return () => {
      logger.info('Cleaning up NDK connection');
      // No explicit disconnect method in NDK, the relays will disconnect naturally
    };
  }, []);
  
  // Login with a private key
  const loginWithPrivateKey = async (privateKey: string): Promise<NostrUser> => {
    if (!ndk) throw new Error('NDK not initialized');
    
    try {
      // Create a signer with the private key
      const signer = new NDKPrivateKeySigner(privateKey);
      ndk.signer = signer;
      
      // Get the user info from the signer
      const ndkUser = await ndk.signer.user();
      
      // Convert to our app's format
      const user: NostrUser = {
        publicKey: ndkUser.pubkey,
        privateKey: privateKey,
        npub: ndkUser.npub,
        nsec: privateKey // Would be converted to proper format in a real app
      };
      
      // Fetch profile if available
      const profile = await fetchUserProfile(user.publicKey);
      if (profile) {
        user.profile = profile;
      }
      
      // Store in local DB
      await db.storeCurrentUser(user);
      
      // Update state
      setUser(user);
      
      return user;
    } catch (error) {
      logger.error('Error logging in with private key', error);
      throw new Error('Failed to login with private key');
    }
  };
  
  // Generate a new user
  const generateNewUser = async (): Promise<NostrUser> => {
    if (!ndk) throw new Error('NDK not initialized');
    
    try {
      // Generate random private key
      const privateKey = window.crypto.getRandomValues(new Uint8Array(32));
      const privateKeyHex = Array.from(privateKey)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      // Create signer and attach to NDK
      const signer = new NDKPrivateKeySigner(privateKeyHex);
      ndk.signer = signer;
      
      // Get the NDK user
      const ndkUser = await signer.user();
      
      // Create our app's user format
      const user: NostrUser = {
        publicKey: ndkUser.pubkey,
        privateKey: privateKeyHex,
        npub: ndkUser.npub,
        nsec: privateKeyHex // Would be converted in a real app
      };
      
      // Store user
      await db.storeCurrentUser(user);
      
      // Update state
      setUser(user);
      
      return user;
    } catch (error) {
      logger.error('Error generating new user', error);
      throw new Error('Failed to generate new user');
    }
  };
  
  // Logout
  const logout = () => {
    // Clear the signer
    if (ndk) {
      ndk.signer = undefined;
    }
    
    // Clear user from state
    setUser(null);
    
    // Clear from local storage
    db.clearCurrentUser();
  };
  
  // Fetch notes
  const fetchNotes = async (limit: number = 50): Promise<NostrEvent[]> => {
    if (!ndk) throw new Error('NDK not initialized');
    
    try {
      logger.info(`Fetching ${limit} notes`);
      
      // Create filter for text notes
      const filter: NDKFilter = {
        kinds: [NDK_EVENT_KIND.TEXT_NOTE],
        limit
      };
      
      return new Promise<NostrEvent[]>((resolve) => {
        const notes: NostrEvent[] = [];
        const subscription = ndk.subscribe(filter, { closeOnEose: true });
        
        // Set a timeout in case we don't receive enough events
        const timeoutId = setTimeout(() => {
          logger.info(`Timeout reached with ${notes.length} notes`);
          if (notes.length > 0) {
            // Sort by created_at, newest first
            notes.sort((a, b) => b.created_at - a.created_at);
            resolve(notes);
          } else {
            // Try a direct fetch as fallback
            logger.info('No notes received via subscription, trying direct fetch');
            ndk.fetchEvents(filter)
              .then(events => {
                const fetchedNotes = Array.from(events).map(event => ({
                  id: event.id,
                  pubkey: event.pubkey,
                  created_at: event.created_at,
                  kind: event.kind,
                  tags: event.tags,
                  content: event.content,
                  sig: event.sig || ""
                }));
                
                // Sort by created_at, newest first
                fetchedNotes.sort((a, b) => b.created_at - a.created_at);
                resolve(fetchedNotes);
              })
              .catch(error => {
                logger.error('Error in fallback fetch', error);
                resolve([]);
              });
          }
        }, 5000);
        
        // Process incoming events
        subscription.on('event', (ndkEvent: NDKEvent) => {
          logger.info(`Received note: ${ndkEvent.content.substring(0, 30)}...`);
          
          const note: NostrEvent = {
            id: ndkEvent.id,
            pubkey: ndkEvent.pubkey,
            created_at: ndkEvent.created_at,
            kind: ndkEvent.kind,
            tags: ndkEvent.tags,
            content: ndkEvent.content,
            sig: ndkEvent.sig || ""
          };
          
          // Cache in local DB
          db.storeEvent(note).catch(e => logger.error('Error storing note', e));
          
          notes.push(note);
        });
        
        // Handle EOSE
        subscription.on('eose', () => {
          clearTimeout(timeoutId);
          logger.info(`EOSE received with ${notes.length} notes`);
          
          // Sort by created_at, newest first
          notes.sort((a, b) => b.created_at - a.created_at);
          resolve(notes);
        });
      });
    } catch (error) {
      logger.error('Error fetching notes', error);
      return [];
    }
  };
  
  // Publish a note
  const publishNote = async (content: string, tags: string[][] = []): Promise<NostrEvent | null> => {
    if (!ndk) throw new Error('NDK not initialized');
    if (!ndk.signer) throw new Error('Not signed in');
    
    try {
      logger.info('Publishing note');
      
      // Create the event
      const event = new NDKEvent(ndk);
      event.kind = NDK_EVENT_KIND.TEXT_NOTE;
      event.content = content;
      event.tags = tags;
      
      // Sign and publish
      await event.publish();
      
      logger.info('Note published successfully');
      
      // Convert to our format
      const note: NostrEvent = {
        id: event.id,
        pubkey: event.pubkey,
        created_at: event.created_at,
        kind: event.kind,
        tags: event.tags,
        content: event.content,
        sig: event.sig || ""
      };
      
      // Cache in local DB
      await db.storeEvent(note);
      
      return note;
    } catch (error) {
      logger.error('Error publishing note', error);
      return null;
    }
  };
  
  // Fetch a user's profile
  const fetchUserProfile = async (pubkey: string): Promise<NostrProfile | undefined> => {
    if (!ndk) throw new Error('NDK not initialized');
    
    try {
      logger.info(`Fetching profile for ${pubkey}`);
      
      // Try to get from local cache first
      const cachedProfile = await db.getProfile(pubkey);
      if (cachedProfile) {
        logger.info('Using cached profile');
        return cachedProfile;
      }
      
      // Get the user from NDK
      const ndkUser = ndk.getUser({ pubkey });
      
      // Fetch their profile from the network
      await ndkUser.fetchProfile();
      
      if (!ndkUser.profile) {
        logger.info('No profile found');
        return undefined;
      }
      
      // Convert to our format
      const profile: NostrProfile = {
        name: ndkUser.profile.name,
        about: ndkUser.profile.about,
        picture: ndkUser.profile.image,
        nip05: ndkUser.profile.nip05
      };
      
      // Cache in local DB
      await db.storeProfile(pubkey, profile);
      
      return profile;
    } catch (error) {
      logger.error('Error fetching user profile', error);
      return undefined;
    }
  };
  
  // Update a user's profile
  const updateUserProfile = async (profile: NostrProfile): Promise<boolean> => {
    if (!ndk) throw new Error('NDK not initialized');
    if (!ndk.signer) throw new Error('Not signed in');
    if (!user) throw new Error('No user logged in');
    
    try {
      logger.info('Updating profile');
      
      // Format profile for NDK
      const profileContent = {
        name: profile.name,
        about: profile.about,
        picture: profile.picture,
        nip05: profile.nip05
      };
      
      // Create metadata event
      const event = new NDKEvent(ndk);
      event.kind = NDK_EVENT_KIND.METADATA;
      event.content = JSON.stringify(profileContent);
      
      // Publish the event
      await event.publish();
      
      logger.info('Profile updated successfully');
      
      // Update local cache
      await db.storeProfile(user.publicKey, profile);
      
      // Update the user state
      setUser({ ...user, profile });
      
      return true;
    } catch (error) {
      logger.error('Error updating profile', error);
      return false;
    }
  };
  
  // Send a direct message
  const sendMessage = async (receiverPubkey: string, content: string): Promise<NostrEvent | null> => {
    if (!ndk) throw new Error('NDK not initialized');
    if (!ndk.signer) throw new Error('Not signed in');
    
    try {
      logger.info(`Sending message to ${receiverPubkey}`);
      
      // Create event for direct message
      const event = new NDKEvent(ndk);
      event.kind = NDK_EVENT_KIND.ENCRYPTED_DIRECT_MESSAGE;
      event.content = content; // NDK handles encryption
      event.tags = [["p", receiverPubkey]];
      
      // Publish the event
      await event.publish();
      
      logger.info('Message sent successfully');
      
      // Convert to our format
      const message: NostrEvent = {
        id: event.id,
        pubkey: event.pubkey,
        created_at: event.created_at,
        kind: event.kind,
        tags: event.tags,
        content: event.content,
        sig: event.sig || ""
      };
      
      // Cache in local DB
      await db.storeEvent(message);
      
      return message;
    } catch (error) {
      logger.error('Error sending message', error);
      return null;
    }
  };
  
  // Fetch messages between current user and another user
  const fetchMessages = async (otherPubkey: string): Promise<NostrEvent[]> => {
    if (!ndk) throw new Error('NDK not initialized');
    if (!ndk.signer) throw new Error('Not signed in');
    if (!user) throw new Error('No user logged in');
    
    try {
      logger.info(`Fetching messages with ${otherPubkey}`);
      
      // Get current user's pubkey
      const currentUser = await ndk.signer.user();
      
      // Create filter for direct messages between the two users
      const filter: NDKFilter = {
        kinds: [NDK_EVENT_KIND.ENCRYPTED_DIRECT_MESSAGE],
        authors: [currentUser.pubkey, otherPubkey],
        "#p": [currentUser.pubkey, otherPubkey]
      };
      
      // Fetch events
      const events = await ndk.fetchEvents(filter);
      
      // Process and decrypt messages
      const messages: NostrEvent[] = [];
      
      await Promise.all(Array.from(events).map(async (event) => {
        let content = event.content;
        
        // If this is a message to us, try to decrypt it
        if (event.pubkey !== currentUser.pubkey) {
          try {
            await event.decrypt();
            // After decryption, the content should be updated
            content = event.content;
          } catch (e) {
            logger.error('Failed to decrypt message', e);
            // Keep encrypted content if decryption fails
          }
        }
        
        const message: NostrEvent = {
          id: event.id,
          pubkey: event.pubkey,
          created_at: event.created_at,
          kind: event.kind,
          tags: event.tags,
          content: content,
          sig: event.sig || ""
        };
        
        // Cache in local DB
        await db.storeEvent(message);
        
        messages.push(message);
      }));
      
      // Sort by time, oldest first for messages
      messages.sort((a, b) => a.created_at - b.created_at);
      
      return messages;
    } catch (error) {
      logger.error('Error fetching messages', error);
      return [];
    }
  };
  
  // Subscribe to notes
  const subscribeToNotes = (
    onEvent: (event: NostrEvent) => void,
    onEose?: () => void,
    customFilter?: { authors?: string[], kinds?: number[] }
  ): (() => void) => {
    if (!ndk) {
      logger.error('NDK not initialized for subscription');
      return () => {};
    }
    
    try {
      logger.info('Setting up note subscription');
      
      // Create filter for subscription
      const filter: NDKFilter = { 
        kinds: customFilter?.kinds || [NDK_EVENT_KIND.TEXT_NOTE]
      };
      
      // Add authors if provided
      if (customFilter?.authors && customFilter.authors.length > 0) {
        filter.authors = customFilter.authors;
      }
      
      // Create subscription
      const subscription = ndk.subscribe(filter);
      
      // Handle events
      subscription.on('event', (ndkEvent: NDKEvent) => {
        logger.debug(`Subscription received event: ${ndkEvent.id}`);
        
        const event: NostrEvent = {
          id: ndkEvent.id,
          pubkey: ndkEvent.pubkey,
          created_at: ndkEvent.created_at,
          kind: ndkEvent.kind,
          tags: ndkEvent.tags,
          content: ndkEvent.content,
          sig: ndkEvent.sig || ""
        };
        
        // Store in local DB
        db.storeEvent(event).catch(e => logger.error('Error storing event from subscription', e));
        
        // Call the callback
        onEvent(event);
      });
      
      // Handle EOSE
      if (onEose) {
        subscription.on('eose', onEose);
      }
      
      // Return unsubscribe function
      return () => {
        logger.info('Unsubscribing from notes');
        subscription.stop();
      };
    } catch (error) {
      logger.error('Error setting up note subscription', error);
      return () => {};
    }
  };
  
  // Get relay status
  const getRelayStatus = async (): Promise<{url: string, connected: boolean}[]> => {
    if (!ndk) throw new Error('NDK not initialized');
    
    try {
      logger.info('Getting relay status');
      
      const relayStatus = Array.from(ndk.pool.relays.values()).map(relay => ({
        url: relay.url,
        connected: relay.connected
      }));
      
      return relayStatus;
    } catch (error) {
      logger.error('Error getting relay status', error);
      return [];
    }
  };
  
  // Add a relay
  const addRelay = async (url: string): Promise<boolean> => {
    if (!ndk) throw new Error('NDK not initialized');
    
    try {
      logger.info(`Adding relay: ${url}`);
      
      // Create a new relay and add it to the pool
      const relay = new NDKRelay(url);
      ndk.pool.addRelay(relay);
      
      // Try to connect
      await relay.connect();
      
      logger.info(`Added relay ${url}, connected: ${relay.connected}`);
      
      return relay.connected;
    } catch (error) {
      logger.error(`Error adding relay ${url}`, error);
      return false;
    }
  };
  
  // Remove a relay
  const removeRelay = async (url: string): Promise<boolean> => {
    if (!ndk) throw new Error('NDK not initialized');
    
    try {
      logger.info(`Removing relay: ${url}`);
      
      // Remove the relay from pool
      const relay = ndk.pool.relays.get(url);
      if (relay) {
        await relay.disconnect();
        ndk.pool.removeRelay(relay);
        logger.info(`Removed relay ${url}`);
        return true;
      } else {
        logger.info(`Relay ${url} not found in pool`);
        return false;
      }
    } catch (error) {
      logger.error(`Error removing relay ${url}`, error);
      return false;
    }
  };
  
  // Create the context value
  const contextValue: NdkContextType = {
    ndk,
    user,
    initialized,
    connecting,
    error,
    loginWithPrivateKey,
    generateNewUser,
    logout,
    fetchNotes,
    publishNote,
    fetchUserProfile,
    updateUserProfile,
    sendMessage,
    fetchMessages,
    subscribeToNotes,
    getRelayStatus,
    addRelay,
    removeRelay
  };
  
  return (
    <NdkContext.Provider value={contextValue}>
      {children}
    </NdkContext.Provider>
  );
};

// Custom hook for easy context usage
export const useNdk = () => useContext(NdkContext);