import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/db';
import { EventKind, NostrEvent, encryptMessage, decryptMessage } from '@/lib/nostr';
import { useToast } from '@/hooks/use-toast';
import { useOffline } from '@/hooks/useOffline';

interface UseNostrReturn {
  loadNotes: (limit?: number) => Promise<NostrEvent[]>;
  postNote: (content: string, tags?: string[][]) => Promise<NostrEvent | null>;
  sendMessage: (receiverPubkey: string, content: string) => Promise<NostrEvent | null>;
  getMessages: (pubkey: string) => Promise<NostrEvent[]>;
  getProfile: (pubkey: string) => Promise<any>;
  updateProfile: (profile: any) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
}

export function useNostr(): UseNostrReturn {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isOffline } = useOffline();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load notes from local cache or API
  const loadNotes = useCallback(async (limit = 50): Promise<NostrEvent[]> => {
    setError(null);
    setIsLoading(true);
    
    try {
      // First try to get from local database
      const cachedNotes = await db.getEventsByKind(EventKind.TEXT_NOTE, limit);
      
      // If we're offline, return the cached notes
      if (isOffline) {
        return cachedNotes;
      }
      
      // If online, fetch fresh notes from API (in a real app this would be from a Nostr relay)
      // This is simulated for the purpose of this demo
      const response = await fetch('/api/notes');
      if (!response.ok) {
        throw new Error('Failed to fetch notes');
      }
      
      const freshNotes = await response.json();
      
      // Store the fresh notes in local database
      for (const note of freshNotes) {
        await db.storeEvent(note);
      }
      
      // Return the fresh notes
      return freshNotes;
    } catch (err) {
      console.error('Error loading notes:', err);
      setError('Failed to load notes');
      
      // If online fetch failed, return cached notes as fallback
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
      // Create a new note event
      const event: NostrEvent = {
        id: '', // Will be set later
        pubkey: user.publicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: EventKind.TEXT_NOTE,
        tags,
        content,
        sig: '', // Will be set later
      };
      
      // In a real app, we would sign the event and get a proper ID
      // For now, use temporary IDs
      event.id = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      event.sig = `sig-${Math.random().toString(36).substring(2, 9)}`;
      
      // Store in local database
      await db.storeEvent(event);
      
      // If online, publish to API
      if (!isOffline) {
        try {
          const response = await fetch('/api/notes', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: 1, // Temporary user ID for demo
              content,
              tags: JSON.stringify(tags),
              eventId: event.id
            }),
          });
          
          if (!response.ok) {
            throw new Error('Failed to publish note');
          }
        } catch (err) {
          console.error('Error publishing note to API:', err);
          toast({
            title: 'Offline Mode',
            description: 'Note saved locally and will sync when online',
          });
        }
      } else {
        toast({
          title: 'Offline Mode',
          description: 'Note saved locally and will sync when online',
        });
      }
      
      return event;
    } catch (err) {
      console.error('Error posting note:', err);
      setError('Failed to post note');
      toast({
        title: 'Error',
        description: 'Failed to post note',
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
      // Encrypt the message content
      const encryptedContent = await encryptMessage(
        { privateKey: user.privateKey },
        receiverPubkey,
        content
      );
      
      // Create a new encrypted direct message event
      const event: NostrEvent = {
        id: '', // Will be set later
        pubkey: user.publicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: EventKind.ENCRYPTED_DIRECT_MESSAGE,
        tags: [['p', receiverPubkey]], // 'p' tag for recipient pubkey
        content: encryptedContent,
        sig: '', // Will be set later
      };
      
      // In a real app, we would sign the event and get a proper ID
      event.id = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      event.sig = `sig-${Math.random().toString(36).substring(2, 9)}`;
      
      // Store in local database
      await db.storeEvent(event);
      
      // If online, publish to API
      if (!isOffline) {
        try {
          const response = await fetch('/api/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              senderId: 1, // Temporary sender ID for demo
              receiverId: 2, // Temporary receiver ID for demo
              content: encryptedContent,
              encrypted: true,
              eventId: event.id
            }),
          });
          
          if (!response.ok) {
            throw new Error('Failed to send message to API');
          }
        } catch (err) {
          console.error('Error sending message to API:', err);
          toast({
            title: 'Offline Mode',
            description: 'Message saved locally and will sync when online',
          });
        }
      } else {
        toast({
          title: 'Offline Mode',
          description: 'Message saved locally and will sync when online',
        });
      }
      
      return event;
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
      toast({
        title: 'Error',
        description: 'Failed to send message',
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
      // Query local database for encrypted direct messages involving both pubkeys
      const allMessages = await db.getEventsByKind(EventKind.ENCRYPTED_DIRECT_MESSAGE);
      
      const relevantMessages = allMessages.filter(event => {
        // Check if this message is between the current user and the specified pubkey
        return (
          (event.pubkey === user.publicKey && event.tags.some(tag => tag[0] === 'p' && tag[1] === pubkey)) ||
          (event.pubkey === pubkey && event.tags.some(tag => tag[0] === 'p' && tag[1] === user.publicKey))
        );
      });
      
      // Sort by timestamp (oldest first for chat view)
      relevantMessages.sort((a, b) => a.created_at - b.created_at);
      
      // If online, try to fetch fresh messages from API
      if (!isOffline) {
        try {
          const response = await fetch(`/api/messages/1/2`); // Temporary IDs for demo
          
          if (response.ok) {
            const freshMessages = await response.json();
            
            // Store the fresh messages in local database
            for (const msg of freshMessages) {
              // Convert API message to Nostr event format
              const event: NostrEvent = {
                id: msg.eventId || `api-${msg.id}`,
                pubkey: msg.senderId === 1 ? user.publicKey : pubkey, // Map sender ID to pubkey
                created_at: new Date(msg.createdAt).getTime() / 1000,
                kind: EventKind.ENCRYPTED_DIRECT_MESSAGE,
                tags: [['p', msg.senderId === 1 ? pubkey : user.publicKey]], // Recipient pubkey
                content: msg.content,
                sig: 'api-sig', // Placeholder
              };
              
              await db.storeEvent(event);
            }
            
            // Reconstruct and return the messages
            return freshMessages.map((msg: any) => ({
              id: msg.eventId || `api-${msg.id}`,
              pubkey: msg.senderId === 1 ? user.publicKey : pubkey,
              created_at: new Date(msg.createdAt).getTime() / 1000,
              kind: EventKind.ENCRYPTED_DIRECT_MESSAGE,
              tags: [['p', msg.senderId === 1 ? pubkey : user.publicKey]],
              content: msg.content,
              sig: 'api-sig',
            }));
          }
        } catch (err) {
          console.error('Error fetching messages from API:', err);
          // Fall back to local messages
        }
      }
      
      return relevantMessages;
    } catch (err) {
      console.error('Error getting messages:', err);
      setError('Failed to get messages');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [user, isOffline]);

  // Get a user profile
  const getProfile = useCallback(async (pubkey: string) => {
    setError(null);
    setIsLoading(true);
    
    try {
      // Check if we have the profile cached
      let profile = await db.getProfile(pubkey);
      
      // If offline, return cached profile
      if (isOffline) {
        return profile || { pubkey, name: 'Unknown User' };
      }
      
      // If online, try to fetch from API
      try {
        // In a real app, we would query a Nostr relay here
        // For this demo, we'll simulate with a fake profile
        if (!profile) {
          profile = {
            pubkey,
            name: `User ${pubkey.substring(0, 5)}`,
            about: 'This is a simulated profile',
            picture: `https://randomuser.me/api/portraits/${Math.random() > 0.5 ? 'men' : 'women'}/${Math.floor(Math.random() * 100)}.jpg`
          };
          
          // Cache the profile
          await db.storeProfile(pubkey, profile);
        }
      } catch (err) {
        console.error('Error fetching profile from API:', err);
        // Fall back to cached profile or default
      }
      
      return profile || { pubkey, name: 'Unknown User' };
    } catch (err) {
      console.error('Error getting profile:', err);
      setError('Failed to get profile');
      return { pubkey, name: 'Unknown User' };
    } finally {
      setIsLoading(false);
    }
  }, [isOffline]);

  // Update user profile
  const updateProfile = useCallback(async (profile: any): Promise<boolean> => {
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
      // Store in local database
      await db.storeProfile(user.publicKey, profile);
      
      // If online, publish to API
      if (!isOffline) {
        try {
          const response = await fetch('/api/users/1', { // Temporary ID for demo
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              displayName: profile.name,
              about: profile.about,
              avatar: profile.picture
            }),
          });
          
          if (!response.ok) {
            throw new Error('Failed to update profile on API');
          }
        } catch (err) {
          console.error('Error updating profile on API:', err);
          toast({
            title: 'Offline Mode',
            description: 'Profile updated locally and will sync when online',
          });
        }
      } else {
        toast({
          title: 'Offline Mode',
          description: 'Profile updated locally and will sync when online',
        });
      }
      
      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });
      
      return true;
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

  return {
    loadNotes,
    postNote,
    sendMessage,
    getMessages,
    getProfile,
    updateProfile,
    isLoading,
    error,
  };
}
