import { useState, useEffect, useCallback } from 'react';
import * as hybridNostr from '@/lib/hybridNostr';
import { NostrEvent, NostrProfile, NostrUser } from '@/lib/nostr';
import logger from '@/lib/logger';

interface UseHybridNostrReturn {
  loadNotes: (limit?: number) => Promise<NostrEvent[]>;
  postNote: (content: string, tags?: string[][]) => Promise<NostrEvent | null>;
  sendMessage: (receiverPubkey: string, content: string) => Promise<NostrEvent | null>;
  getMessages: (pubkey: string) => Promise<NostrEvent[]>;
  getProfile: (pubkey: string) => Promise<NostrProfile & { pubkey: string } | null>;
  updateProfile: (profile: NostrProfile) => Promise<boolean>;
  getRelays: () => Promise<{url: string, connected: boolean}[]>;
  addRelay: (url: string) => Promise<boolean>;
  removeRelay: (url: string) => Promise<boolean>;
  // Social interaction methods
  createReaction: (eventId: string, content?: string) => Promise<NostrEvent | null>;
  repostNote: (eventId: string, eventPubkey: string) => Promise<NostrEvent | null>;
  replyToNote: (eventId: string, eventPubkey: string, rootId: string | null, content: string, additionalTags?: string[][]) => Promise<NostrEvent | null>;
  getReactions: (eventId: string) => Promise<NostrEvent[]>;
  getReposts: (eventId: string) => Promise<NostrEvent[]>;
  getReplies: (eventId: string) => Promise<NostrEvent[]>;
  subscribeToNotes: (
    onEvent: (event: NostrEvent) => void,
    onEose?: () => void,
    filter?: { authors?: string[], kinds?: number[] }
  ) => () => void;
  isLoading: boolean;
  error: string | null;
}

export function useHybridNostr(): UseHybridNostrReturn {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        await hybridNostr.initialize();
      } catch (error) {
        logger.error('Error initializing Hybrid Nostr:', error);
        setError('Failed to initialize Nostr client');
      }
    };
    
    initialize();
    
    // Clean up on unmount
    return () => {
      hybridNostr.cleanup().catch(error => {
        logger.error('Error cleaning up Hybrid Nostr:', error);
      });
    };
  }, []);
  
  // Load notes
  const loadNotes = useCallback(async (limit: number = 50): Promise<NostrEvent[]> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const notes = await hybridNostr.fetchNotes(limit);
      return notes;
    } catch (error) {
      logger.error('Error loading notes:', error);
      setError('Failed to load notes');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Post a note
  const postNote = useCallback(async (content: string, tags: string[][] = []): Promise<NostrEvent | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const event = await hybridNostr.publishNote(content, tags);
      return event;
    } catch (error) {
      logger.error('Error posting note:', error);
      setError('Failed to post note');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Send a message
  const sendMessage = useCallback(async (receiverPubkey: string, content: string): Promise<NostrEvent | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const event = await hybridNostr.sendMessage(receiverPubkey, content);
      return event;
    } catch (error) {
      logger.error('Error sending message:', error);
      setError('Failed to send message');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Get messages
  const getMessages = useCallback(async (pubkey: string): Promise<NostrEvent[]> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const events = await hybridNostr.fetchMessages(pubkey);
      return events;
    } catch (error) {
      logger.error('Error getting messages:', error);
      setError('Failed to get messages');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Get a user's profile
  const getProfile = useCallback(async (pubkey: string): Promise<(NostrProfile & { pubkey: string }) | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const profile = await hybridNostr.fetchUserProfile(pubkey);
      
      if (!profile) {
        return null;
      }
      
      return { ...profile, pubkey };
    } catch (error) {
      logger.error('Error getting profile:', error);
      setError('Failed to get profile');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Update a user's profile
  const updateProfile = useCallback(async (profile: NostrProfile): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const success = await hybridNostr.updateUserProfile(profile);
      return success;
    } catch (error) {
      logger.error('Error updating profile:', error);
      setError('Failed to update profile');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Get relay status
  const getRelays = useCallback(async (): Promise<{url: string, connected: boolean}[]> => {
    try {
      return await hybridNostr.getRelayStatus();
    } catch (error) {
      logger.error('Error getting relay status:', error);
      setError('Failed to get relay status');
      return [];
    }
  }, []);
  
  // Add a relay
  const addRelay = useCallback(async (url: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const success = await hybridNostr.addRelay(url);
      return success;
    } catch (error) {
      logger.error(`Error adding relay ${url}:`, error);
      setError('Failed to add relay');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Remove a relay
  const removeRelay = useCallback(async (url: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const success = await hybridNostr.removeRelay(url);
      return success;
    } catch (error) {
      logger.error(`Error removing relay ${url}:`, error);
      setError('Failed to remove relay');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Subscribe to notes
  const subscribeToNotes = useCallback((
    onEvent: (event: NostrEvent) => void,
    onEose?: () => void,
    filter?: { authors?: string[], kinds?: number[] }
  ): (() => void) => {
    try {
      return hybridNostr.subscribeToNotes(onEvent, onEose, filter);
    } catch (error) {
      logger.error('Error subscribing to notes:', error);
      setError('Failed to subscribe to notes');
      return () => {};
    }
  }, []);
  
  // Create a reaction (like)
  const createReaction = useCallback(async (eventId: string, content: string = "+"): Promise<NostrEvent | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const event = await hybridNostr.createReaction(eventId, content);
      return event;
    } catch (error) {
      logger.error('Error creating reaction:', error);
      setError('Failed to create reaction');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Repost a note
  const repostNote = useCallback(async (eventId: string, eventPubkey: string): Promise<NostrEvent | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const event = await hybridNostr.repostNote(eventId, eventPubkey);
      return event;
    } catch (error) {
      logger.error('Error reposting note:', error);
      setError('Failed to repost note');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Reply to a note
  const replyToNote = useCallback(async (
    eventId: string, 
    eventPubkey: string, 
    rootId: string | null, 
    content: string, 
    additionalTags: string[][] = []
  ): Promise<NostrEvent | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const event = await hybridNostr.replyToNote(eventId, eventPubkey, rootId, content, additionalTags);
      return event;
    } catch (error) {
      logger.error('Error replying to note:', error);
      setError('Failed to reply to note');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Get reactions
  const getReactions = useCallback(async (eventId: string): Promise<NostrEvent[]> => {
    try {
      return await hybridNostr.getReactions(eventId);
    } catch (error) {
      logger.error('Error getting reactions:', error);
      setError('Failed to get reactions');
      return [];
    }
  }, []);
  
  // Get reposts
  const getReposts = useCallback(async (eventId: string): Promise<NostrEvent[]> => {
    try {
      return await hybridNostr.getReposts(eventId);
    } catch (error) {
      logger.error('Error getting reposts:', error);
      setError('Failed to get reposts');
      return [];
    }
  }, []);
  
  // Get replies
  const getReplies = useCallback(async (eventId: string): Promise<NostrEvent[]> => {
    try {
      return await hybridNostr.getReplies(eventId);
    } catch (error) {
      logger.error('Error getting replies:', error);
      setError('Failed to get replies');
      return [];
    }
  }, []);

  return {
    loadNotes,
    postNote,
    sendMessage,
    getMessages,
    getProfile,
    updateProfile,
    getRelays,
    addRelay,
    removeRelay,
    // Social interaction methods
    createReaction,
    repostNote,
    replyToNote,
    getReactions,
    getReposts,
    getReplies,
    subscribeToNotes,
    isLoading,
    error
  };
}