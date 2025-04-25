import { useState, useEffect } from 'react';
import { useNDK, useSubscription } from '@nostr-dev-kit/ndk-hooks';
import { NDKEvent, NDKFilter, NDKSubscriptionOptions } from '@nostr-dev-kit/ndk';
import logger from '../lib/logger';
import { NostrEvent } from '../lib/nostr';
import { db } from '../lib/db';

// Post events are kind 1 in Nostr
const TEXT_NOTE_KIND = 1;

// Hook for fetching and working with posts
export function useNodusPosts(limit: number = 50) {
  const { ndk } = useNDK();
  const [posts, setPosts] = useState<NostrEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter for text notes (posts)
  const filter: NDKFilter = {
    kinds: [TEXT_NOTE_KIND],
    limit
  };
  
  // Subscription options
  const options: NDKSubscriptionOptions = {
    closeOnEose: false
  };
  
  // Get events with useSubscription hook
  const { events, eose } = useSubscription({
    filter,
    options,
    enabled: !!ndk
  });
  
  // Convert NDKEvents to NostrEvents and store in state
  useEffect(() => {
    if (!events.length) return;
    
    const convertedEvents = events.map(event => convertNDKEventToNostrEvent(event));
    
    // Sort by created_at, newest first
    convertedEvents.sort((a, b) => b.created_at - a.created_at);
    
    // Store events in local database
    convertedEvents.forEach(event => {
      db.storeEvent(event).catch(err => {
        logger.error('Error storing event in database', err);
      });
    });
    
    setPosts(convertedEvents);
  }, [events]);
  
  // Update loading state when EOSE is received
  useEffect(() => {
    if (eose) {
      setIsLoading(false);
    }
  }, [eose]);
  
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
    } catch (err) {
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