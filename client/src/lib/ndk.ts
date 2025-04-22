import NDK, { NDKEvent, NDKNip07Signer, NDKPrivateKeySigner, NDKUser, NDKFilter, NDKRelay, NDKSubscription } from '@nostr-dev-kit/ndk';
import { db } from './db';
import { NostrEvent, NostrProfile, NostrUser, EventKind } from './nostr';
import { getRelayManager, DEFAULT_RELAYS } from './relayManager';
import logger from './logger';

// NDK singleton
let ndkInstance: NDK | null = null;

/**
 * Get the NDK instance, creating and connecting to it if necessary
 */
export const getNDK = async (): Promise<NDK> => {
  if (!ndkInstance) {
    // Initialize NDK with only mynodus relay for verified community
    ndkInstance = new NDK({
      explicitRelayUrls: ['wss://relay.mynodus.org'],
      enableOutboxModel: true, // for offline functionality
    });
    
    // Connect to relays
    await ndkInstance.connect();
    
    // Initialize relay manager with NDK instance
    const relayManager = getRelayManager();
    await relayManager.initialize(ndkInstance);
  }
  
  return ndkInstance;
};

/**
 * Sign in with a private key
 */
export const loginWithPrivateKey = async (privateKey: string): Promise<NostrUser> => {
  try {
    const ndk = await getNDK();
    const signer = new NDKPrivateKeySigner(privateKey);
    ndk.signer = signer;
    
    const ndkUser = await ndk.signer.user();
    
    // Convert to our app's NostrUser format
    const user: NostrUser = {
      publicKey: ndkUser.pubkey,
      privateKey: privateKey,
      npub: ndkUser.npub,
      nsec: privateKey // This would be converted to nsec format in a real application
    };
    
    // Fetch and store user profile
    const profile = await fetchUserProfile(ndkUser.pubkey);
    if (profile) {
      user.profile = profile;
    }
    
    // Store in local DB
    await db.storeCurrentUser(user);
    
    return user;
  } catch (error) {
    console.error("Error logging in with private key:", error);
    throw new Error("Failed to login with private key");
  }
};

/**
 * Generate a new user with keypair
 */
export const generateNewUser = async (): Promise<NostrUser> => {
  try {
    // Generate a new key pair
    const ndk = await getNDK();
    
    // Create new private key signer with a random key
    const privateKey = window.crypto.getRandomValues(new Uint8Array(32));
    const privateKeyHex = Array.from(privateKey)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const signer = new NDKPrivateKeySigner(privateKeyHex);
    ndk.signer = signer;
    
    // Get the user associated with the signer
    const user = await signer.user();
    
    // Create our user format
    const nostrUser: NostrUser = {
      publicKey: user.pubkey,
      privateKey: privateKeyHex,
      npub: user.npub,
      nsec: privateKeyHex // This would be converted to proper bech32 format in real app
    };
    
    // Store user
    await db.storeCurrentUser(nostrUser);
    
    return nostrUser;
  } catch (error) {
    console.error("Error generating new user:", error);
    throw new Error("Failed to generate new user");
  }
};

/**
 * Fetch a user's profile from the network
 */
export const fetchUserProfile = async (pubkey: string): Promise<NostrProfile | undefined> => {
  try {
    const ndk = await getNDK();
    const user = ndk.getUser({ pubkey });
    await user.fetchProfile();
    
    if (!user.profile) {
      return undefined;
    }
    
    // Convert to our app format
    const profile: NostrProfile = {
      name: user.profile.name,
      about: user.profile.about,
      picture: user.profile.image,
      nip05: user.profile.nip05
    };
    
    // Cache in local DB
    await db.storeProfile(pubkey, profile);
    
    return profile;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return undefined;
  }
};

/**
 * Update a user's profile
 */
export const updateUserProfile = async (pubkey: string, profile: NostrProfile): Promise<boolean> => {
  try {
    const ndk = await getNDK();
    
    if (!ndk.signer) {
      throw new Error("Not signed in");
    }
    
    // Format profile for NDK
    const profileContent = {
      name: profile.name,
      about: profile.about,
      picture: profile.picture,
      nip05: profile.nip05
    };
    
    // Create metadata event (kind 0)
    const event = new NDKEvent(ndk);
    event.kind = 0; // Metadata event
    event.content = JSON.stringify(profileContent);
    
    // Publish the event
    await event.publish();
    
    // Update local cache
    await db.storeProfile(pubkey, profile);
    
    return true;
  } catch (error) {
    console.error("Error updating profile:", error);
    return false;
  }
};

/**
 * Create and publish a text note
 */
export const publishNote = async (content: string, tags: string[][] = []): Promise<NostrEvent | null> => {
  try {
    const ndk = await getNDK();
    
    if (!ndk.signer) {
      throw new Error("Not signed in");
    }
    
    // Create event
    const event = new NDKEvent(ndk);
    event.kind = EventKind.TEXT_NOTE;
    event.content = content;
    event.tags = tags;
    
    // Sign and publish
    await event.publish();
    
    // Convert to our format
    const nostrEvent: NostrEvent = {
      id: event.id,
      pubkey: event.pubkey,
      created_at: event.created_at,
      kind: event.kind,
      tags: event.tags,
      content: event.content,
      sig: event.sig || ""
    };
    
    // Cache in local DB
    await db.storeEvent(nostrEvent);
    
    return nostrEvent;
  } catch (error) {
    console.error("Error publishing note:", error);
    return null;
  }
};

/**
 * Fetch recent notes from the network using NDK subscription
 */
export const fetchNotes = async (limit: number = 50): Promise<NostrEvent[]> => {
  try {
    const ndk = await getNDK();
    logger.info("Getting notes with NDK subscription");
    
    // Create filter for text notes
    const filter: NDKFilter = {
      kinds: [EventKind.TEXT_NOTE],
      limit
    };
    
    return new Promise<NostrEvent[]>((resolve) => {
      const notes: NostrEvent[] = [];
      const subscription = ndk.subscribe(filter, { closeOnEose: true });
      
      subscription.on('event', async (event: NDKEvent) => {
        logger.info(`Received note: ${event.content.substring(0, 30)}...`);
        
        const note: NostrEvent = {
          id: event.id,
          pubkey: event.pubkey,
          created_at: event.created_at,
          kind: event.kind,
          tags: event.tags,
          content: event.content,
          sig: event.sig || ""
        };
        
        // Cache event in local DB
        try {
          await db.storeEvent(note);
        } catch (e) {
          logger.error("Error storing note in DB:", e);
        }
        
        notes.push(note);
      });
      
      subscription.on('eose', () => {
        logger.info(`EOSE received with ${notes.length} notes`);
        // Sort by created_at, newest first
        notes.sort((a, b) => b.created_at - a.created_at);
        resolve(notes);
      });
      
      // Add a fallback timeout in case EOSE never comes
      setTimeout(() => {
        if (notes.length > 0) {
          logger.info(`Timeout reached with ${notes.length} notes`);
          // Sort by created_at, newest first
          notes.sort((a, b) => b.created_at - a.created_at);
          subscription.stop();
          resolve(notes);
        } else {
          // Try a normal fetch as fallback
          logger.info("No notes received via subscription, trying normal fetch");
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
              
              // Store events in local DB
              for (const note of fetchedNotes) {
                db.storeEvent(note).catch(e => logger.error("Error storing fetched note:", e));
              }
              
              fetchedNotes.sort((a, b) => b.created_at - a.created_at);
              subscription.stop();
              resolve(fetchedNotes);
            })
            .catch(error => {
              logger.error("Error in fallback fetch:", error);
              subscription.stop();
              resolve([]);
            });
        }
      }, 5000); // 5 second timeout
    });
  } catch (error) {
    logger.error("Error in NDK fetchNotes:", error);
    return [];
  }
};

/**
 * Send a direct message to a user
 */
export const sendMessage = async (receiverPubkey: string, content: string): Promise<NostrEvent | null> => {
  try {
    const ndk = await getNDK();
    
    if (!ndk.signer) {
      throw new Error("Not signed in");
    }
    
    const receiver = ndk.getUser({ pubkey: receiverPubkey });
    
    // Encrypt and create message event
    const event = new NDKEvent(ndk);
    event.kind = EventKind.ENCRYPTED_DIRECT_MESSAGE;
    event.content = content; // Will be encrypted automatically
    event.tags = [["p", receiverPubkey]];
    
    // Will encrypt, sign, and publish
    await event.publish();
    
    // Convert to our format
    const message: NostrEvent = {
      id: event.id,
      pubkey: event.pubkey,
      created_at: event.created_at,
      kind: event.kind,
      tags: event.tags,
      content: event.content, // This is the encrypted content
      sig: event.sig || ""
    };
    
    // Cache in local DB
    await db.storeEvent(message);
    
    return message;
  } catch (error) {
    console.error("Error sending message:", error);
    return null;
  }
};

/**
 * Fetch messages between the current user and another user
 */
export const fetchMessages = async (otherPubkey: string): Promise<NostrEvent[]> => {
  try {
    const ndk = await getNDK();
    
    if (!ndk.signer) {
      throw new Error("Not signed in");
    }
    
    const user = await ndk.signer.user();
    
    // Filter to find direct messages between the two users
    const filter: NDKFilter = {
      kinds: [EventKind.ENCRYPTED_DIRECT_MESSAGE],
      authors: [user.pubkey, otherPubkey],
      "#p": [user.pubkey, otherPubkey]
    };
    
    // Fetch events
    const events = await ndk.fetchEvents(filter);
    
    // Convert to our format and decrypt if needed
    const messages: NostrEvent[] = [];
    
    // Process each event
    await Promise.all(Array.from(events).map(async (event) => {
      let content = event.content;
      
      // If this is a message to us, try to decrypt it
      if (event.pubkey !== user.pubkey) {
        try {
          // Cast to string explicitly to fix TypeScript error
          const decrypted = await event.decrypt();
          content = decrypted as string;
        } catch (e) {
          logger.error("Failed to decrypt message:", e);
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
      
      // Cache event
      await db.storeEvent(message);
      
      messages.push(message);
    }));
    
    // Sort by time, oldest first for messages
    messages.sort((a, b) => a.created_at - b.created_at);
    
    return messages;
  } catch (error) {
    console.error("Error fetching messages:", error);
    return [];
  }
};

/**
 * Create a live subscription to new notes
 */
export const subscribeToNotes = (
  onEvent: (event: NostrEvent) => void,
  onEose?: () => void
): (() => void) => {
  try {
    const ndk = ndkInstance;
    if (!ndk) {
      console.error("NDK not initialized");
      return () => {}; // Return empty unsubscribe function
    }
    
    // Create filter for text notes
    const filter: NDKFilter = { 
      kinds: [EventKind.TEXT_NOTE]
    };
    
    // Subscribe to events
    const subscription = ndk.subscribe(filter);
    
    // Set up event handler
    subscription.on('event', (ndkEvent: NDKEvent) => {
      const event: NostrEvent = {
        id: ndkEvent.id,
        pubkey: ndkEvent.pubkey,
        created_at: ndkEvent.created_at,
        kind: ndkEvent.kind,
        tags: ndkEvent.tags,
        content: ndkEvent.content,
        sig: ndkEvent.sig || ""
      };
      
      // Store event in local DB
      db.storeEvent(event).then(() => {
        // Notify callback
        onEvent(event);
      });
    });
    
    // Handle EOSE (End of Stored Events)
    if (onEose) {
      subscription.on('eose', onEose);
    }
    
    // Return unsubscribe function
    return () => {
      subscription.stop();
    };
  } catch (error) {
    console.error("Error setting up note subscription:", error);
    return () => {}; // Return empty unsubscribe function
  }
};

/**
 * Get relay status for debugging
 */
export const getRelayStatus = async (): Promise<{url: string, connected: boolean}[]> => {
  try {
    const ndk = await getNDK();
    
    const relayStatus = Array.from(ndk.pool.relays.values()).map((relay: NDKRelay) => ({
      url: relay.url,
      connected: relay.connected
    }));
    
    return relayStatus;
  } catch (error) {
    console.error("Error getting relay status:", error);
    return [];
  }
};

/**
 * Add a relay to NDK
 */
export const addRelayToNDK = async (url: string): Promise<boolean> => {
  try {
    logger.info(`Attempting to add relay: ${url}`);
    const ndk = await getNDK();
    
    // Check if the URL is valid
    if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
      logger.error(`Invalid relay URL: ${url}. Must start with wss:// or ws://`);
      return false;
    }
    
    // Add to explicit relays
    if (!ndk.explicitRelayUrls.includes(url)) {
      ndk.explicitRelayUrls.push(url);
    }
    logger.debug(`Updated explicit relay URLs`, ndk.explicitRelayUrls);
    
    try {
      // Simple direct approach - add to pool and connect
      if (!ndk.pool.relays.has(url)) {
        logger.info(`Adding new relay to pool: ${url}`);
        
        try {
          // Create a new relay and connect
          // TypeScript complains but this is the correct NDK usage 
          const relay = new NDKRelay(url, ndk);
          
          // Log WebSocket construction
          logger.debug(`Creating WebSocket for ${url}...`);
          
          // Register event listeners for detailed debugging
          relay.on('connect', () => {
            logger.info(`WebSocket CONNECTED to ${url}`);
          });
          
          relay.on('disconnect', () => {
            logger.warn(`WebSocket DISCONNECTED from ${url}`);
          });
          
          // Use notice for errors since 'error' event isn't in the type definition
          relay.on('notice', (notice) => {
            if (notice && notice.includes('error')) {
              logger.error(`WebSocket ERROR for ${url}:`, notice);
            }
          });
          
          // Add to pool before connecting
          ndk.pool.relays.set(url, relay);
          
          // Attempt connection with timeout
          const connectPromise = relay.connect();
          
          // Add a timeout for connection attempts
          const timeoutPromise = new Promise<void>((_, reject) => {
            setTimeout(() => reject(new Error(`Connection timeout for ${url}`)), 10000);
          });
          
          // Race the connection against a timeout
          await Promise.race([connectPromise, timeoutPromise]);
          logger.info(`Successfully connected to relay: ${url}`);
        } catch (e) {
          logger.error(`Failed to connect to relay ${url}:`, e);
          
          // Additional WebSocket environment diagnostics
          if (typeof WebSocket === 'undefined') {
            logger.error('WebSocket is undefined in this environment!');
          } else {
            logger.debug('WebSocket implementation available:', WebSocket.name || 'Native WebSocket');
          }
          
          // Additional network diagnostics
          try {
            logger.debug(`Performing fetch test against ${url.replace('wss://', 'https://').replace('ws://', 'http://')}`);
            // We can't use fetch directly on the WebSocket URL, so we'll try the HTTP equivalent
            const fetchUrl = url.replace('wss://', 'https://').replace('ws://', 'http://');
            const fetchTest = await fetch(fetchUrl, { method: 'HEAD' }).catch(e => ({ error: e }));
            logger.debug('Fetch test result:', fetchTest);
          } catch (fetchError) {
            logger.error('Fetch test failed:', fetchError);
          }
        }
      } else {
        // Already exists in pool
        logger.info(`Relay already exists in pool: ${url}`);
        
        // Try to reconnect if not connected
        const existingRelay = ndk.pool.relays.get(url);
        if (existingRelay && !existingRelay.connected) {
          try {
            logger.debug(`Attempting to reconnect to existing relay: ${url}`);
            await existingRelay.connect();
            logger.info(`Reconnected to existing relay: ${url}`);
          } catch (e) {
            logger.error(`Failed to reconnect to existing relay ${url}:`, e);
          }
        }
      }
      
      // Get the relay from the pool after connection attempts
      const addedRelay = ndk.pool.relays.get(url);
      const isConnected = addedRelay?.connected || false;
      
      logger.info(`Relay ${url} connection status: ${isConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
      return addedRelay ? true : false;
    } catch (error) {
      logger.error(`Failed to add relay ${url}:`, error);
      return false;
    }
  } catch (error) {
    logger.error("Error adding relay to NDK:", error);
    return false;
  }
};

/**
 * Verify if a user is NIP-05 verified
 */
export const isNIP05Verified = async (pubkey: string): Promise<boolean> => {
  try {
    const ndk = await getNDK();
    const user = ndk.getUser({ pubkey });
    await user.fetchProfile();
    
    // Check if user has a valid NIP-05 identifier
    return !!user.profile?.nip05;
  } catch (error) {
    logger.error("Error checking NIP-05 verification:", error);
    return false;
  }
};

/**
 * Check if a user is personally approved to join Nodus
 * In a production app, this would check against a database of approved users
 */
export const isPersonallyApproved = async (pubkey: string): Promise<boolean> => {
  try {
    // This is a placeholder. In a real application, you would:
    // 1. Check a database of approved users
    // 2. Or verify against a list maintained by relay.mynodus.org
    // 3. Or use a kind 30001 parameterized replacement (NIP-51) list of approved users

    // For now, we'll simulate by checking if the user has NIP-05 verification
    const hasNIP05 = await isNIP05Verified(pubkey);
    
    // In the future, expand this with actual verification logic
    return hasNIP05;
  } catch (error) {
    logger.error("Error checking personal approval:", error);
    return false;
  }
};

/**
 * Filter function that can be used to filter notes/users that are
 * part of the closed Nodus network (NIP-05 verified and personally approved)
 */
export const isPartOfNodusNetwork = async (pubkey: string): Promise<boolean> => {
  // User must be NIP-05 verified
  const hasNIP05 = await isNIP05Verified(pubkey);
  if (!hasNIP05) return false;
  
  // User must be personally approved
  const isApproved = await isPersonallyApproved(pubkey);
  if (!isApproved) return false;
  
  return true;
};

export const removeRelayFromNDK = async (url: string): Promise<boolean> => {
  try {
    const ndk = await getNDK();
    
    // Remove from explicit relays
    ndk.explicitRelayUrls = ndk.explicitRelayUrls.filter(u => u !== url);
    
    // Get the relay from pool
    const relay = ndk.pool.relays.get(url);
    
    if (relay) {
      // Try to disconnect
      if (relay.connected) {
        try {
          console.log(`Disconnecting from relay: ${url}`);
          if (typeof relay.disconnect === 'function') {
            await relay.disconnect();
          }
        } catch (e) {
          console.error(`Error disconnecting from relay ${url}:`, e);
        }
      }
      
      // Remove from pool
      ndk.pool.relays.delete(url);
      console.log(`Removed relay from pool: ${url}`);
    } else {
      console.log(`Relay not found in pool: ${url}`);
    }
    
    return true;
  } catch (error) {
    console.error("Error removing relay from NDK:", error);
    return false;
  }
};