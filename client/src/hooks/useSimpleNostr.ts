import { useState, useEffect, useCallback } from 'react';
import * as simpleNostr from '@/lib/simpleNostr';
import { NostrEvent, NostrProfile, NostrUser } from '@/lib/nostr';
import logger from '@/lib/logger';

interface UseSimpleNostrReturn {
  loadNotes: (limit?: number) => Promise<NostrEvent[]>;
  postNote: (content: string, tags?: string[][]) => Promise<NostrEvent | null>;
  getProfile: (pubkey: string) => Promise<NostrProfile & { pubkey: string } | null>;
  updateProfile: (profile: NostrProfile) => Promise<boolean>;
  getRelays: () => Promise<{url: string, connected: boolean}[]>;
  addRelay: (url: string) => Promise<boolean>;
  removeRelay: (url: string) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
}

export function useSimpleNostr(): UseSimpleNostrReturn {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        await simpleNostr.initialize();
      } catch (error) {
        logger.error('Error initializing Simple Nostr:', error);
        setError('Failed to initialize Nostr client');
      }
    };
    
    initialize();
    
    // Clean up on unmount
    return () => {
      simpleNostr.cleanup().catch(error => {
        logger.error('Error cleaning up Simple Nostr:', error);
      });
    };
  }, []);
  
  // Load notes
  const loadNotes = useCallback(async (limit: number = 50): Promise<NostrEvent[]> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const notes = await simpleNostr.fetchNotes(limit);
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
      const event = await simpleNostr.publishNote(content, tags);
      return event;
    } catch (error) {
      logger.error('Error posting note:', error);
      setError('Failed to post note');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Get a user's profile
  const getProfile = useCallback(async (pubkey: string): Promise<(NostrProfile & { pubkey: string }) | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const profile = await simpleNostr.fetchUserProfile(pubkey);
      
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
      const success = await simpleNostr.updateUserProfile(profile);
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
      return await simpleNostr.getRelayStatus();
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
      const success = await simpleNostr.addRelay(url);
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
      const success = await simpleNostr.removeRelay(url);
      return success;
    } catch (error) {
      logger.error(`Error removing relay ${url}:`, error);
      setError('Failed to remove relay');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  return {
    loadNotes,
    postNote,
    getProfile,
    updateProfile,
    getRelays,
    addRelay,
    removeRelay,
    isLoading,
    error
  };
}