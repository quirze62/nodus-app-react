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
  
  // Initialize NDK (but don't connect to relays through NDK)
  await ndk.getNDK();
  
  initialized = true;
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
    
    // Store the current user
    currentUser = ndkUser;
    
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
    
    // Store the current user
    currentUser = ndkUser;
    
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