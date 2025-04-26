import { useState, useEffect, useCallback } from 'react';
import { getNDK, publishNote, fetchNotes, publishEvent } from '@/lib/ndk';
import { NostrEvent, NostrProfile, EventKind } from '@/lib/nostr';
import logger from '@/lib/logger';
import NDK, { NDKEvent, NDKFilter } from '@nostr-dev-kit/ndk';

interface UseNdkReturn {
  getProfile: (pubkey: string) => Promise<(NostrProfile & { pubkey: string }) | null>;
  createReaction: (eventId: string, content: string) => Promise<NostrEvent | null>;
  repostNote: (eventId: string, eventPubkey: string) => Promise<NostrEvent | null>;
  replyToNote: (eventId: string, eventPubkey: string, rootId: string | undefined, content: string, additionalTags?: string[][]) => Promise<NostrEvent | null>;
  getReactions: (eventId: string) => Promise<NostrEvent[]>;
  getReposts: (eventId: string) => Promise<NostrEvent[]>;
  getReplies: (eventId: string) => Promise<NostrEvent[]>;
  postNote: (content: string, tags?: string[][]) => Promise<NostrEvent | null>;
  loadNotes: (limit?: number) => Promise<NostrEvent[]>;
  isLoading: boolean;
  error: string | null;
}

export function useNdk(): UseNdkReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const initialize = async () => {
      try {
        // Ensure NDK is initialized
        await getNDK();
      } catch (err) {
        console.error('Error initializing NDK:', err);
        setError('Failed to initialize Nostr connection');
      }
    };
    
    initialize();
    
    // Cleanup function
    return () => {
      // Any cleanup logic if needed
    };
  }, []);
  
  // Fetch user profile
  const getProfile = useCallback(async (pubkey: string): Promise<(NostrProfile & { pubkey: string }) | null> => {
    try {
      const ndk = await getNDK();
      const user = ndk.getUser({ pubkey });
      await user.fetchProfile();
      
      if (!user.profile) {
        return null;
      }
      
      return {
        pubkey,
        name: user.profile.name || '',
        about: user.profile.about || '',
        picture: user.profile.image || '',
        nip05: user.profile.nip05 || ''
      };
    } catch (error) {
      console.error(`Error fetching profile for ${pubkey}:`, error);
      return null;
    }
  }, []);
  
  // Create a reaction (like) to an event
  const createReaction = useCallback(async (eventId: string, content: string): Promise<NostrEvent | null> => {
    try {
      const ndk = await getNDK();
      const event = new NDKEvent(ndk);
      
      event.kind = EventKind.REACTION;
      event.content = content; // Usually "+" for like
      event.tags = [
        ['e', eventId],
      ];
      
      await event.publish();
      
      // Convert to our format
      return {
        id: event.id,
        pubkey: event.pubkey,
        created_at: event.created_at,
        kind: event.kind,
        tags: event.tags,
        content: event.content,
        sig: event.sig || ""
      };
    } catch (error) {
      logger.error('Error creating reaction:', error);
      return null;
    }
  }, []);
  
  // Create a repost
  const repostNote = useCallback(async (eventId: string, eventPubkey: string): Promise<NostrEvent | null> => {
    try {
      const ndk = await getNDK();
      const event = new NDKEvent(ndk);
      
      event.kind = EventKind.REPOST;
      event.content = ""; // Repost events typically have empty content
      event.tags = [
        ['e', eventId],
        ['p', eventPubkey]
      ];
      
      await event.publish();
      
      // Convert to our format
      return {
        id: event.id,
        pubkey: event.pubkey,
        created_at: event.created_at,
        kind: event.kind,
        tags: event.tags,
        content: event.content,
        sig: event.sig || ""
      };
    } catch (error) {
      logger.error('Error creating repost:', error);
      return null;
    }
  }, []);
  
  // Reply to a note
  const replyToNote = useCallback(async (
    eventId: string, 
    eventPubkey: string, 
    rootId: string | undefined, 
    content: string,
    additionalTags: string[][] = []
  ): Promise<NostrEvent | null> => {
    try {
      const ndk = await getNDK();
      const event = new NDKEvent(ndk);
      
      event.kind = EventKind.TEXT_NOTE;
      event.content = content;
      
      // Start with basic tags for the direct parent
      const tags = [
        ['e', eventId, '', 'reply'],
        ['p', eventPubkey]
      ];
      
      // Add root tag if this is a reply to a reply (thread)
      if (rootId && rootId !== eventId) {
        tags.push(['e', rootId, '', 'root']);
      }
      
      // Add any additional tags
      event.tags = [...tags, ...additionalTags];
      
      await event.publish();
      
      // Convert to our format
      return {
        id: event.id,
        pubkey: event.pubkey,
        created_at: event.created_at,
        kind: event.kind,
        tags: event.tags,
        content: event.content,
        sig: event.sig || ""
      };
    } catch (error) {
      logger.error('Error creating reply:', error);
      return null;
    }
  }, []);
  
  // Get reactions to an event
  const getReactions = useCallback(async (eventId: string): Promise<NostrEvent[]> => {
    try {
      logger.info(`Getting reactions to event ${eventId}`);
      const ndk = await getNDK();
      
      const filter: NDKFilter = {
        kinds: [EventKind.REACTION],
        '#e': [eventId]
      };
      
      logger.info(`Fetching events with filter: ${JSON.stringify(filter)}`);
      const events = await ndk.fetchEvents(filter);
      
      const reactions: NostrEvent[] = [];
      events.forEach((ndkEvent: NDKEvent) => {
        reactions.push({
          id: ndkEvent.id,
          pubkey: ndkEvent.pubkey,
          created_at: ndkEvent.created_at,
          kind: ndkEvent.kind,
          tags: ndkEvent.tags,
          content: ndkEvent.content,
          sig: ndkEvent.sig || ""
        });
      });
      
      return reactions;
    } catch (error) {
      logger.error(`Error getting reactions for ${eventId}:`, error);
      return [];
    }
  }, []);
  
  // Get reposts of an event
  const getReposts = useCallback(async (eventId: string): Promise<NostrEvent[]> => {
    try {
      logger.info(`Getting reposts of event ${eventId}`);
      const ndk = await getNDK();
      
      const filter: NDKFilter = {
        kinds: [EventKind.REPOST],
        '#e': [eventId]
      };
      
      logger.info(`Fetching events with filter: ${JSON.stringify(filter)}`);
      const events = await ndk.fetchEvents(filter);
      
      const reposts: NostrEvent[] = [];
      events.forEach((ndkEvent: NDKEvent) => {
        reposts.push({
          id: ndkEvent.id,
          pubkey: ndkEvent.pubkey,
          created_at: ndkEvent.created_at,
          kind: ndkEvent.kind,
          tags: ndkEvent.tags,
          content: ndkEvent.content,
          sig: ndkEvent.sig || ""
        });
      });
      
      return reposts;
    } catch (error) {
      logger.error(`Error getting reposts for ${eventId}:`, error);
      return [];
    }
  }, []);
  
  // Get replies to an event
  const getReplies = useCallback(async (eventId: string): Promise<NostrEvent[]> => {
    try {
      logger.info(`Getting replies to event ${eventId}`);
      const ndk = await getNDK();
      
      const filter: NDKFilter = {
        kinds: [EventKind.TEXT_NOTE],
        '#e': [eventId]
      };
      
      logger.info(`Fetching events with filter: ${JSON.stringify(filter)}`);
      const events = await ndk.fetchEvents(filter);
      
      const replies: NostrEvent[] = [];
      events.forEach((ndkEvent: NDKEvent) => {
        // Only include actual replies, not just events that mention this one
        const isReply = ndkEvent.tags.some(tag => 
          tag[0] === 'e' && tag[1] === eventId && (tag[3] === 'reply' || !tag[3])
        );
        
        if (isReply) {
          replies.push({
            id: ndkEvent.id,
            pubkey: ndkEvent.pubkey,
            created_at: ndkEvent.created_at,
            kind: ndkEvent.kind,
            tags: ndkEvent.tags,
            content: ndkEvent.content,
            sig: ndkEvent.sig || ""
          });
        }
      });
      
      return replies;
    } catch (error) {
      logger.error(`Error getting replies for ${eventId}:`, error);
      return [];
    }
  }, []);
  
  // Post a new note
  const postNote = useCallback(async (content: string, tags: string[][] = []): Promise<NostrEvent | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const event = await publishNote(content, tags);
      return event;
    } catch (error) {
      console.error('Error posting note:', error);
      setError('Failed to post note');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Load recent notes
  const loadNotes = useCallback(async (limit: number = 50): Promise<NostrEvent[]> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const notes = await fetchNotes(limit);
      return notes;
    } catch (error) {
      console.error('Error loading notes:', error);
      setError('Failed to load notes');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  return {
    getProfile,
    createReaction,
    repostNote,
    replyToNote,
    getReactions,
    getReposts,
    getReplies,
    postNote,
    loadNotes,
    isLoading,
    error
  };
}