import { useState, useEffect, useCallback } from 'react';
import { NDKEvent, NDKFilter, NDKSubscriptionOptions, NDKSubscription } from '@nostr-dev-kit/ndk';
import { useNdk } from '../contexts/NdkContext';
import { useAuth } from '../contexts/AuthContext';
import logger from '../lib/logger';
import { NostrEvent, EventKind } from '../lib/nostr';
import { db } from '../lib/db';

// Hook for fetching and working with posts
export function useNodusPosts(limit: number = 50) {
  const { ndk, user: ndkUser } = useNdk();
  const { user: authUser } = useAuth();
  const [posts, setPosts] = useState<NostrEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter for text notes (posts)
  // We'll filter for NIP-05 verified users
  const filter: NDKFilter = {
    kinds: [EventKind.TEXT_NOTE],
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
    db.getEventsByKind(EventKind.TEXT_NOTE, limit)
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
    
    if (!ndk.signer) {
      setError('Authentication required to create posts');
      logger.error('Attempted to create post without authentication');
      return null;
    }
    
    try {
      const event = new NDKEvent(ndk);
      event.kind = EventKind.TEXT_NOTE;
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
  
  // Function to like a post (create a reaction)
  const likePost = async (postId: string, postPubkey: string): Promise<NostrEvent | null> => {
    if (!ndk) {
      setError('NDK not initialized');
      return null;
    }
    
    if (!ndk.signer) {
      setError('Authentication required to like posts');
      logger.error('Attempted to like post without authentication');
      return null;
    }
    
    try {
      logger.info(`Creating reaction for post ${postId}`);
      
      const event = new NDKEvent(ndk);
      event.kind = EventKind.REACTION;
      event.content = '+'; // "+" is a like in Nostr
      event.tags = [
        ['e', postId], // The event being reacted to
        ['p', postPubkey] // The author of the original event
      ];
      
      await event.publish();
      
      logger.info('Successfully liked post');
      
      const reaction = convertNDKEventToNostrEvent(event);
      
      // Store in local DB
      await db.storeEvent(reaction);
      
      return reaction;
    } catch (err) {
      logger.error('Error liking post', err);
      setError('Failed to like post');
      return null;
    }
  };
  
  // Function to repost a post
  const repostPost = async (postId: string, postPubkey: string): Promise<NostrEvent | null> => {
    if (!ndk) {
      setError('NDK not initialized');
      return null;
    }
    
    if (!ndk.signer) {
      setError('Authentication required to repost');
      logger.error('Attempted to repost without authentication');
      return null;
    }
    
    try {
      logger.info(`Creating repost for event ${postId}`);
      
      const event = new NDKEvent(ndk);
      event.kind = EventKind.REPOST;
      event.content = ''; // Repost events typically have empty content
      event.tags = [
        ['e', postId], // The event being reposted
        ['p', postPubkey] // The author of the original event
      ];
      
      await event.publish();
      
      logger.info('Successfully reposted');
      
      const repost = convertNDKEventToNostrEvent(event);
      
      // Store in local DB
      await db.storeEvent(repost);
      
      return repost;
    } catch (err) {
      logger.error('Error reposting', err);
      setError('Failed to repost');
      return null;
    }
  };
  
  // Function to reply to a post
  const replyToPost = async (
    postId: string, 
    postPubkey: string, 
    rootId: string | undefined, 
    content: string,
    additionalTags: string[][] = []
  ): Promise<NostrEvent | null> => {
    if (!ndk) {
      setError('NDK not initialized');
      return null;
    }
    
    if (!ndk.signer) {
      setError('Authentication required to reply');
      logger.error('Attempted to reply without authentication');
      return null;
    }
    
    try {
      logger.info(`Creating reply to post ${postId}`);
      
      const event = new NDKEvent(ndk);
      event.kind = EventKind.TEXT_NOTE;
      event.content = content;
      
      // Start with basic tags for the direct parent
      const tags = [
        ['e', postId, '', 'reply'], // The event being replied to
        ['p', postPubkey] // The author of that event
      ];
      
      // Add root tag if this is a reply to a reply (thread)
      if (rootId && rootId !== postId) {
        tags.push(['e', rootId, '', 'root']);
      }
      
      // Add any additional tags
      event.tags = [...tags, ...additionalTags];
      
      await event.publish();
      
      logger.info('Successfully replied to post');
      
      const reply = convertNDKEventToNostrEvent(event);
      
      // Store in local DB
      await db.storeEvent(reply);
      
      return reply;
    } catch (err) {
      logger.error('Error replying to post', err);
      setError('Failed to send reply');
      return null;
    }
  };
  
  return {
    posts,
    isLoading,
    error,
    createPost,
    likePost,
    repostPost,
    replyToPost,
    isAuthenticated: !!ndk?.signer
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