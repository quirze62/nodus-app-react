import NDK, { NDKEvent, NDKNip07Signer, NDKPrivateKeySigner, NDKUser, NDKFilter, NDKRelay, NDKSubscription } from '@nostr-dev-kit/ndk';
import { db } from './db';
import { NostrEvent, NostrProfile, NostrUser, EventKind } from './nostr';

// Default relays
const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.current.fyi'
];

// NDK singleton
let ndkInstance: NDK | null = null;

/**
 * Get the NDK instance, creating and connecting to it if necessary
 */
export const getNDK = async (): Promise<NDK> => {
  if (!ndkInstance) {
    ndkInstance = new NDK({
      explicitRelayUrls: DEFAULT_RELAYS,
      enableOutboxModel: true, // for offline functionality
    });
    
    await ndkInstance.connect();
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
 * Fetch recent notes from the network
 */
export const fetchNotes = async (limit: number = 50): Promise<NostrEvent[]> => {
  try {
    const ndk = await getNDK();
    
    // Create filter for text notes
    const filter: NDKFilter = {
      kinds: [EventKind.TEXT_NOTE],
      limit
    };
    
    // Fetch events
    const events = await ndk.fetchEvents(filter);
    
    // Convert to our format and sort by creation time
    const notes: NostrEvent[] = [];
    
    // Convert NDKEvents to array of our NostrEvent format
    Array.from(events).forEach(async (event) => {
      const note: NostrEvent = {
        id: event.id,
        pubkey: event.pubkey,
        created_at: event.created_at,
        kind: event.kind,
        tags: event.tags,
        content: event.content,
        sig: event.sig || ""
      };
      
      // Cache event
      await db.storeEvent(note);
      
      notes.push(note);
    });
    
    // Sort by time, newest first
    notes.sort((a, b) => b.created_at - a.created_at);
    
    return notes;
  } catch (error) {
    console.error("Error fetching notes:", error);
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
          content = await event.decrypt();
        } catch (e) {
          console.error("Failed to decrypt message:", e);
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
    const filter: NDKFilter = { kinds: [EventKind.TEXT_NOTE] };
    
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