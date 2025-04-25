import { useState, useEffect, useCallback } from 'react';
import { NDKEvent, NDKFilter, NDKSubscriptionOptions, NDKSubscription } from '@nostr-dev-kit/ndk';
import { useNdk } from '../contexts/NdkContext';
import logger from '../lib/logger';
import { NostrEvent } from '../lib/nostr';
import { db } from '../lib/db';

// Post events are kind 1 in Nostr
const TEXT_NOTE_KIND = 1;

// Hook for fetching and working with posts
export function useNodusPosts(limit: number = 50) {
  const { ndk } = useNdk();
  const [posts, setPosts] = useState<NostrEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter for text notes (posts)
  // We'll filter for NIP-05 verified users
  const filter: NDKFilter = {
    kinds: [TEXT_NOTE_KIND],
    limit
  };
  
  // Subscription options
  const options: NDKSubscriptionOptions = {
    closeOnEose: false
  };
  
  // Set up subscription to posts
  useEffect(() => {
    if (!ndk) return;
    
    setIsLoading(true);
    logger.info(`Fetching up to ${limit} posts from Nostr network`);
    
    // Start with posts from database
    db.getEventsByKind(TEXT_NOTE_KIND, limit)
      .then((dbEvents: NostrEvent[]) => {
        if (dbEvents.length > 0) {
          logger.info(`Loaded ${dbEvents.length} posts from local database`);
          setPosts(dbEvents.sort((a: NostrEvent, b: NostrEvent) => b.created_at - a.created_at));
        }
      })
      .catch((err: Error) => {
        logger.error('Error loading posts from database', err);
      });
    
    // Create subscription
    const subscription = ndk.subscribe(filter, options);
    const events: NostrEvent[] = [];
    
    // Handle events as they come in
    subscription.on('event', async (ndkEvent: NDKEvent) => {
      const event = convertNDKEventToNostrEvent(ndkEvent);
      
      // Check for verified users (has NIP-05)
      try {
        // Get profile for author if we don't already have it
        const ndkUser = ndk.getUser({ pubkey: event.pubkey });
        await ndkUser.fetchProfile();
        
        // Only allow posts from users with NIP-05 verification
        if (ndkUser.profile?.nip05) {
          logger.info(`Accepted post from verified user: ${ndkUser.profile.nip05}`);
          events.push(event);
          
          // Store in database
          db.storeEvent(event).catch((err: Error) => {
            logger.error('Error storing event in database', err);
          });
          
          // Sort and update state
          const sortedEvents = [...events].sort((a: NostrEvent, b: NostrEvent) => b.created_at - a.created_at);
          setPosts(sortedEvents);
        } else {
          logger.info(`Skipped post from unverified user: ${event.pubkey}`);
        }
      } catch (err) {
        logger.error('Error fetching user profile for verification', err);
      }
    });
    
    // Handle end of stored events
    subscription.on('eose', () => {
      logger.info(`Received EOSE with ${events.length} posts`);
      setIsLoading(false);
    });
    
    // Clean up subscription on unmount
    return () => {
      logger.info('Cleaning up posts subscription');
      subscription.stop();
    };
  }, [ndk, limit]);
  
  // Function to create a new post
  const createPost = async (content: string, tags: string[][] = []): Promise<NostrEvent | null> => {
    if (!ndk) {
      setError('NDK not initialized');
      return null;
    }
    
    try {
      const event = new NDKEvent(ndk);
      event.kind = TEXT_NOTE_KIND;
      event.content = content;
      event.tags = tags;
      
      await event.publish();
      
      const newPost = convertNDKEventToNostrEvent(event);
      
      // Store in local database
      await db.storeEvent(newPost);
      
      // Update state (add to beginning as it's the newest)
      setPosts(prevPosts => [newPost, ...prevPosts]);
      
      return newPost;
    } catch (err: any) {
      logger.error('Error creating post', err);
      setError('Failed to create post');
      return null;
    }
  };
  
  return {
    posts,
    isLoading,
    error,
    createPost
  };
}

// Helper function to convert NDKEvent to NostrEvent
function convertNDKEventToNostrEvent(event: NDKEvent): NostrEvent {
  return {
    id: event.id,
    pubkey: event.pubkey,
    created_at: event.created_at,
    kind: event.kind,
    tags: event.tags,
    content: event.content,
    sig: event.sig || ""
  };
}