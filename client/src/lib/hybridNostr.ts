import * as ndk from './ndk';
import * as simpleRelay from './simpleRelayConnector';
import * as simpleNostr from './simpleNostr';
import { NostrEvent, NostrProfile, NostrUser } from './nostr';
import logger from './logger';

/**
 * Hybrid Nostr client that uses our custom WebSocket implementation
 * for relay connections but NDK for feed population and notes management.
 */

// Initialize state
let initialized = false;
let currentUser: NostrUser | null = null;

// Initialize the hybrid client
export const initialize = async (): Promise<void> => {
  if (initialized) return;
  
  logger.info('Initializing Hybrid Nostr client');
  
  // Initialize our custom WebSocket implementation
  await simpleNostr.initialize();
  
  // Initialize NDK with default relays
  await ndk.getNDK();
  
  initialized = true;
  
  // Try to reconnect if there's a stored user
  try {
    const storedUser = localStorage.getItem('currentNostrUser');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      if (user && user.privateKey) {
        await loginWithPrivateKey(user.privateKey);
      }
    }
  } catch (error) {
    logger.error('Error auto-logging in:', error);
  }
};

// Clean up
export const cleanup = async (): Promise<void> => {
  logger.info('Cleaning up Hybrid Nostr client');
  
  // Clean up our custom WebSocket implementation
  await simpleNostr.cleanup();
  
  initialized = false;
};

// Login with a private key
export const loginWithPrivateKey = async (privateKey: string): Promise<NostrUser> => {
  logger.info('Logging in with private key (hybrid mode)');
  
  try {
    // Use NDK to generate key pair and user profile
    const ndkUser = await ndk.loginWithPrivateKey(privateKey);
    
    // Store the current user in memory
    currentUser = ndkUser;
    
    // Also store in localStorage for persistence across sessions
    try {
      localStorage.setItem('currentNostrUser', JSON.stringify(ndkUser));
    } catch (e) {
      logger.warn('Failed to store user in localStorage:', e);
    }
    
    // Make sure our custom relays are also connected
    try {
      await simpleNostr.loginWithPrivateKey(privateKey);
    } catch (e) {
      logger.warn('Failed to connect custom relays with private key:', e);
    }
    
    return ndkUser;
  } catch (error) {
    logger.error('Error logging in with private key:', error);
    throw error;
  }
};

// Generate a new user
export const generateNewUser = async (): Promise<NostrUser> => {
  logger.info('Generating new user (hybrid mode)');
  
  try {
    // Use NDK to generate key pair and user profile
    const ndkUser = await ndk.generateNewUser();
    
    // Store the current user in memory
    currentUser = ndkUser;
    
    // Also store in localStorage for persistence across sessions
    try {
      localStorage.setItem('currentNostrUser', JSON.stringify(ndkUser));
    } catch (e) {
      logger.warn('Failed to store user in localStorage:', e);
    }
    
    // Make sure our custom relays are also connected
    try {
      if (ndkUser.privateKey) {
        await simpleNostr.loginWithPrivateKey(ndkUser.privateKey);
      } else {
        logger.warn('No private key available for custom relay connection');
      }
    } catch (e) {
      logger.warn('Failed to connect custom relays with new user:', e);
    }
    
    return ndkUser;
  } catch (error) {
    logger.error('Error generating new user:', error);
    throw error;
  }
};

// Fetch a user's profile
export const fetchUserProfile = async (pubkey: string): Promise<NostrProfile | undefined> => {
  logger.info(`Fetching profile for ${pubkey} (hybrid mode)`);
  
  try {
    // Try to fetch using NDK first
    try {
      const profile = await ndk.fetchUserProfile(pubkey);
      if (profile) {
        return profile;
      }
    } catch (error) {
      logger.warn('NDK failed to fetch profile, falling back to simple implementation:', error);
    }
    
    // Fall back to our custom implementation
    return simpleNostr.fetchUserProfile(pubkey);
  } catch (error) {
    logger.error('Error fetching user profile:', error);
    return undefined;
  }
};

// Update a user's profile
export const updateUserProfile = async (profile: NostrProfile): Promise<boolean> => {
  logger.info('Updating user profile (hybrid mode)');
  
  if (!currentUser) {
    logger.error('No current user');
    return false;
  }
  
  try {
    // Try to update using NDK first
    try {
      const success = await ndk.updateUserProfile(currentUser.publicKey, profile);
      if (success) {
        return true;
      }
    } catch (error) {
      logger.warn('NDK failed to update profile, falling back to simple implementation:', error);
    }
    
    // Fall back to our custom implementation
    return simpleNostr.updateUserProfile(profile);
  } catch (error) {
    logger.error('Error updating user profile:', error);
    return false;
  }
};

// Publish a note
export const publishNote = async (content: string, tags: string[][] = []): Promise<NostrEvent | null> => {
  logger.info('Publishing note (hybrid mode)');
  
  try {
    // Try to publish using NDK first
    try {
      const event = await ndk.publishNote(content, tags);
      if (event) {
        return event;
      }
    } catch (error) {
      logger.warn('NDK failed to publish note, falling back to simple implementation:', error);
    }
    
    // Fall back to our custom implementation
    return simpleNostr.publishNote(content, tags);
  } catch (error) {
    logger.error('Error publishing note:', error);
    return null;
  }
};

// Fetch recent notes
export const fetchNotes = async (limit: number = 50): Promise<NostrEvent[]> => {
  logger.info(`Fetching ${limit} recent notes (hybrid mode)`);
  
  try {
    // Try to fetch using NDK first
    try {
      const notes = await ndk.fetchNotes(limit);
      if (notes.length > 0) {
        return notes;
      }
    } catch (error) {
      logger.warn('NDK failed to fetch notes, falling back to simple implementation:', error);
    }
    
    // Fall back to our custom implementation
    return simpleNostr.fetchNotes(limit);
  } catch (error) {
    logger.error('Error fetching notes:', error);
    return [];
  }
};

// Send a direct message
export const sendMessage = async (receiverPubkey: string, content: string): Promise<NostrEvent | null> => {
  logger.info(`Sending message to ${receiverPubkey} (hybrid mode)`);
  
  if (!currentUser) {
    logger.error('No current user');
    return null;
  }
  
  try {
    // Try to send using NDK
    return await ndk.sendMessage(receiverPubkey, content);
  } catch (error) {
    logger.error('Error sending message:', error);
    return null;
  }
};

// Fetch messages between the current user and another user
export const fetchMessages = async (otherPubkey: string): Promise<NostrEvent[]> => {
  logger.info(`Fetching messages with ${otherPubkey} (hybrid mode)`);
  
  if (!currentUser) {
    logger.error('No current user');
    return [];
  }
  
  try {
    // Try to fetch using NDK
    return await ndk.fetchMessages(otherPubkey);
  } catch (error) {
    logger.error('Error fetching messages:', error);
    return [];
  }
};

// Get relay status
export const getRelayStatus = async (): Promise<{url: string, connected: boolean}[]> => {
  try {
    // Get relay status from our custom implementation
    return simpleNostr.getRelayStatus();
  } catch (error) {
    logger.error('Error getting relay status:', error);
    return [];
  }
};

// Add a relay
export const addRelay = async (url: string): Promise<boolean> => {
  try {
    // Add relay using our custom implementation
    return simpleNostr.addRelay(url);
  } catch (error) {
    logger.error(`Error adding relay ${url}:`, error);
    return false;
  }
};

// Remove a relay
export const removeRelay = async (url: string): Promise<boolean> => {
  try {
    // Remove relay using our custom implementation
    return simpleNostr.removeRelay(url);
  } catch (error) {
    logger.error(`Error removing relay ${url}:`, error);
    return false;
  }
};

// Create a reaction to a note (like)
export const createReaction = async (eventId: string, content: string = "+"): Promise<NostrEvent | null> => {
  logger.info(`Creating reaction to event ${eventId} (hybrid mode)`);
  
  if (!currentUser) {
    logger.error('No current user');
    return null;
  }
  
  try {
    // Create a reaction event with the "e" tag pointing to the original event
    const tags = [
      ["e", eventId], // Reference to the original event
    ];
    
    // Try to publish using NDK
    return await ndk.publishEvent(7, content, tags); // Kind 7 = reaction
  } catch (error) {
    logger.error('Error creating reaction:', error);
    return null;
  }
};

// Repost a note
export const repostNote = async (eventId: string, eventPubkey: string): Promise<NostrEvent | null> => {
  logger.info(`Reposting event ${eventId} (hybrid mode)`);
  
  if (!currentUser) {
    logger.error('No current user');
    return null;
  }
  
  try {
    // Create a repost event with the "e" tag pointing to the original event
    // and "p" tag pointing to the author of the original event
    const tags = [
      ["e", eventId], // Reference to the original event
      ["p", eventPubkey], // Reference to the original author
    ];
    
    // Try to publish using NDK
    return await ndk.publishEvent(6, "", tags); // Kind 6 = repost
  } catch (error) {
    logger.error('Error reposting note:', error);
    return null;
  }
};

// Reply to a note (create a thread)
export const replyToNote = async (
  eventId: string, 
  eventPubkey: string, 
  rootId: string | null, 
  content: string,
  additionalTags: string[][] = []
): Promise<NostrEvent | null> => {
  logger.info(`Replying to event ${eventId} (hybrid mode)`);
  
  if (!currentUser) {
    logger.error('No current user');
    return null;
  }
  
  try {
    // Build the tags for the reply
    const tags = [
      ["e", eventId, "", "reply"], // Reference to the parent event
      ["p", eventPubkey], // Reference to the parent author
    ];
    
    // If there's a root event different from the parent, add it too
    if (rootId && rootId !== eventId) {
      tags.push(["e", rootId, "", "root"]); // Reference to the root event
    }
    
    // Add any additional tags
    tags.push(...additionalTags);
    
    // Try to publish using NDK
    return await ndk.publishNote(content, tags);
  } catch (error) {
    logger.error('Error replying to note:', error);
    return null;
  }
};

// Get reactions to a note
export const getReactions = async (eventId: string): Promise<NostrEvent[]> => {
  logger.info(`Getting reactions to event ${eventId} (hybrid mode)`);
  
  try {
    // Try to fetch using NDK with a specific filter for reactions
    const filter = {
      kinds: [7], // Kind 7 = reaction
      "#e": [eventId], // Events that reference the target event
    };
    
    return await ndk.fetchEventsWithFilter(filter);
  } catch (error) {
    logger.error('Error getting reactions:', error);
    return [];
  }
};

// Get reposts of a note
export const getReposts = async (eventId: string): Promise<NostrEvent[]> => {
  logger.info(`Getting reposts of event ${eventId} (hybrid mode)`);
  
  try {
    // Try to fetch using NDK with a specific filter for reposts
    const filter = {
      kinds: [6], // Kind 6 = repost
      "#e": [eventId], // Events that reference the target event
    };
    
    return await ndk.fetchEventsWithFilter(filter);
  } catch (error) {
    logger.error('Error getting reposts:', error);
    return [];
  }
};

// Get replies to a note (thread)
export const getReplies = async (eventId: string): Promise<NostrEvent[]> => {
  logger.info(`Getting replies to event ${eventId} (hybrid mode)`);
  
  try {
    // Try to fetch using NDK with a specific filter for replies
    const filter = {
      kinds: [1], // Kind 1 = text note
      "#e": [eventId], // Events that reference the target event
    };
    
    return await ndk.fetchEventsWithFilter(filter);
  } catch (error) {
    logger.error('Error getting replies:', error);
    return [];
  }
};

// Subscribe to notes
export const subscribeToNotes = (
  onEvent: (event: NostrEvent) => void,
  onEose?: () => void,
  filter?: { authors?: string[], kinds?: number[] }
): (() => void) => {
  // Use NDK subscription
  try {
    return ndk.subscribeToNotes(onEvent, onEose, filter);
  } catch (error) {
    logger.error('Error subscribing to notes:', error);
    return () => {}; // Return a no-op unsubscribe function
  }
};