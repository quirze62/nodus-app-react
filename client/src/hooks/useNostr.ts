import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/db';
import { EventKind, NostrEvent, NostrProfile } from '@/lib/nostr';
import { useToast } from '@/hooks/use-toast';
import { useOffline } from '@/hooks/useOffline';
import { 
  getNDK, 
  fetchNotes, 
  publishNote, 
  sendMessage as ndkSendMessage, 
  fetchMessages as ndkFetchMessages,
  fetchUserProfile,
  updateUserProfile,
  getRelayStatus
} from '@/lib/ndk';

interface UseNostrReturn {
  loadNotes: (limit?: number) => Promise<NostrEvent[]>;
  postNote: (content: string, tags?: string[][]) => Promise<NostrEvent | null>;
  sendMessage: (receiverPubkey: string, content: string) => Promise<NostrEvent | null>;
  getMessages: (pubkey: string) => Promise<NostrEvent[]>;
  getProfile: (pubkey: string) => Promise<NostrProfile & { pubkey: string }>;
  updateProfile: (profile: NostrProfile) => Promise<boolean>;
  getRelays: () => Promise<{url: string, connected: boolean}[]>;
  isLoading: boolean;
  error: string | null;
}

export function useNostr(): UseNostrReturn {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isOffline } = useOffline();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize NDK on first load
  useEffect(() => {
    const initNDK = async () => {
      try {
        // Connect to NDK
        await getNDK();
      } catch (err) {
        console.error('Error initializing NDK:', err);
      }
    };
    
    initNDK();
  }, []);

  // Load notes from NDK or local cache
  const loadNotes = useCallback(async (limit = 50): Promise<NostrEvent[]> => {
    setError(null);
    setIsLoading(true);
    
    try {
      // If offline, return from local cache
      if (isOffline) {
        const cachedNotes = await db.getEventsByKind(EventKind.TEXT_NOTE, limit);
        return cachedNotes;
      }
      
      // If online, fetch from NDK
      const notes = await fetchNotes(limit);
      return notes;
    } catch (err) {
      console.error('Error loading notes:', err);
      setError('Failed to load notes');
      
      // If fetch failed, return cached notes as fallback
      return await db.getEventsByKind(EventKind.TEXT_NOTE, limit);
    } finally {
      setIsLoading(false);
    }
  }, [isOffline]);

  // Post a new note
  const postNote = useCallback(async (content: string, tags: string[][] = []): Promise<NostrEvent | null> => {
    if (!user?.publicKey || !user?.privateKey) {
      setError('You must be logged in to post');
      toast({
        title: 'Authentication Required',
        description: 'You must be logged in to post',
        variant: 'destructive'
      });
      return null;
    }
    
    setError(null);
    setIsLoading(true);
    
    try {
      // Create and publish note using NDK
      const note = await publishNote(content, tags);
      
      if (note) {
        toast({
          title: 'Success',
          description: 'Note published successfully',
        });
      } else if (isOffline) {
        toast({
          title: 'Offline Mode',
          description: 'Note saved locally and will sync when online',
        });
      }
      
      return note;
    } catch (err) {
      console.error('Error posting note:', err);
      setError('Failed to post note');
      toast({
        title: 'Error',
        description: 'Failed to post note. Will retry when online.',
        variant: 'destructive'
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, isOffline, toast]);

  // Send a private message
  const sendMessage = useCallback(async (receiverPubkey: string, content: string): Promise<NostrEvent | null> => {
    if (!user?.publicKey || !user?.privateKey) {
      setError('You must be logged in to send messages');
      toast({
        title: 'Authentication Required',
        description: 'You must be logged in to send messages',
        variant: 'destructive'
      });
      return null;
    }
    
    setError(null);
    setIsLoading(true);
    
    try {
      // Send encrypted message using NDK
      const message = await ndkSendMessage(receiverPubkey, content);
      
      if (message) {
        toast({
          title: 'Success',
          description: 'Message sent successfully',
        });
      } else if (isOffline) {
        toast({
          title: 'Offline Mode',
          description: 'Message saved locally and will sync when online',
        });
      }
      
      return message;
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
      toast({
        title: 'Error',
        description: 'Failed to send message. Will retry when online.',
        variant: 'destructive'
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, isOffline, toast]);

  // Get messages with a specific user
  const getMessages = useCallback(async (pubkey: string): Promise<NostrEvent[]> => {
    if (!user?.publicKey) {
      setError('You must be logged in to view messages');
      return [];
    }
    
    setError(null);
    setIsLoading(true);
    
    try {
      // If offline, get from local cache
      if (isOffline) {
        const allMessages = await db.getEventsByKind(EventKind.ENCRYPTED_DIRECT_MESSAGE);
        
        const relevantMessages = allMessages.filter(event => {
          // Check if message is between current user and specified pubkey
          return (
            (event.pubkey === user.publicKey && event.tags.some(tag => tag[0] === 'p' && tag[1] === pubkey)) ||
            (event.pubkey === pubkey && event.tags.some(tag => tag[0] === 'p' && tag[1] === user.publicKey))
          );
        });
        
        // Sort by timestamp (oldest first for chat view)
        relevantMessages.sort((a, b) => a.created_at - b.created_at);
        return relevantMessages;
      }
      
      // If online, fetch from NDK
      const messages = await ndkFetchMessages(pubkey);
      return messages;
    } catch (err) {
      console.error('Error getting messages:', err);
      setError('Failed to get messages');
      
      // Fallback to local cache
      const cachedMessages = await db.getEventsByKind(EventKind.ENCRYPTED_DIRECT_MESSAGE);
      return cachedMessages.filter(event => {
        return (
          (event.pubkey === user.publicKey && event.tags.some(tag => tag[0] === 'p' && tag[1] === pubkey)) ||
          (event.pubkey === pubkey && event.tags.some(tag => tag[0] === 'p' && tag[1] === user.publicKey))
        );
      }).sort((a, b) => a.created_at - b.created_at);
    } finally {
      setIsLoading(false);
    }
  }, [user, isOffline]);

  // Get a user profile
  const getProfile = useCallback(async (pubkey: string): Promise<NostrProfile & { pubkey: string }> => {
    setError(null);
    setIsLoading(true);
    
    try {
      // Check if we have the profile cached
      let profile = await db.getProfile(pubkey);
      
      // If offline, return cached profile or default
      if (isOffline) {
        return profile || { 
          pubkey, 
          name: pubkey.slice(0, 8), 
          about: '',
          picture: '',
          nip05: ''
        };
      }
      
      // If online, fetch from NDK
      if (!profile) {
        const ndkProfile = await fetchUserProfile(pubkey);
        if (ndkProfile) {
          profile = { 
            pubkey,
            ...ndkProfile
          };
        }
      }
      
      return profile || { 
        pubkey, 
        name: pubkey.slice(0, 8), 
        about: '',
        picture: '',
        nip05: ''
      };
    } catch (err) {
      console.error('Error getting profile:', err);
      setError('Failed to get profile');
      
      // Return default profile as fallback
      return { 
        pubkey, 
        name: pubkey.slice(0, 8), 
        about: '',
        picture: '',
        nip05: ''
      };
    } finally {
      setIsLoading(false);
    }
  }, [isOffline]);

  // Update user profile
  const updateProfile = useCallback(async (profile: NostrProfile): Promise<boolean> => {
    if (!user?.publicKey) {
      setError('You must be logged in to update your profile');
      toast({
        title: 'Authentication Required',
        description: 'You must be logged in to update your profile',
        variant: 'destructive'
      });
      return false;
    }
    
    setError(null);
    setIsLoading(true);
    
    try {
      // Update profile using NDK
      const success = await updateUserProfile(user.publicKey, profile);
      
      if (success) {
        toast({
          title: 'Success',
          description: 'Profile updated successfully',
        });
      } else if (isOffline) {
        // Store locally if offline
        await db.storeProfile(user.publicKey, profile);
        toast({
          title: 'Offline Mode',
          description: 'Profile updated locally and will sync when online',
        });
      }
      
      return success || isOffline;
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('Failed to update profile');
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, isOffline, toast]);

  // Get relay status for debugging
  const getRelays = useCallback(async (): Promise<{url: string, connected: boolean}[]> => {
    try {
      return await getRelayStatus();
    } catch (err) {
      console.error('Error getting relay status:', err);
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
    isLoading,
    error,
  };
}