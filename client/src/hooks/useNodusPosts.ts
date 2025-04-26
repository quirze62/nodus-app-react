// client/src/hooks/useNodusPosts.ts
import { useNDK, useSubscribe } from '@nostr-dev-kit/ndk-hooks';
import { useState, useEffect, useContext } from 'react';
import { NDKEvent, NDKFilter, NDK } from '@nostr-dev-kit/ndk';
import { AuthContext } from '@/contexts/AuthContext';
import logger from '../lib/logger';
import { FilterMode } from '@/components/feed/FeedFilters';
import { db } from '../lib/db';

// Type for our posts
interface Post {
  id: string;
  pubkey: string;
  content: string;
  created_at: number;
  tags: string[][];
  kind: number;
  sig?: string;
  engagement?: number;
}

// Hook for fetching and working with posts
export function useNodusPosts(filterMode: FilterMode = 'all', limit: number = 50) {
  const { ndk } = useNDK();
  const { user } = useContext(AuthContext);
  const [verifiedPosts, setVerifiedPosts] = useState<Post[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user follows
  const [follows, setFollows] = useState<string[]>([]);
  
  // Get follow events
  const followFilter = user ? { kinds: [3], authors: [user.publicKey] } : null;
  const { events: followEvents } = useSubscribe({
    filters: followFilter ? [followFilter] : [],
    enabled: !!ndk && !!user && !!followFilter
  });

  useEffect(() => {
    if (followEvents.length > 0) {
      const followPubkeys = followEvents[0].tags
        .filter(tag => tag[0] === 'p')
        .map(tag => tag[1]);
      setFollows(followPubkeys);
      logger.info(`Follows: ${followPubkeys.length}`); // Debug
    }
  }, [followEvents]);

  // Fetch follows of follows
  const [followsOfFollows, setFollowsOfFollows] = useState<string[]>([]);
  
  // Get follow-of-follows events
  const followsOfFollowsFilter = follows.length > 0 ? { kinds: [3], authors: follows } : null;
  const { events: followsOfFollowsEvents } = useSubscribe({
    filters: followsOfFollowsFilter ? [followsOfFollowsFilter] : [],
    enabled: !!ndk && follows.length > 0 && filterMode === 'follows'
  });

  useEffect(() => {
    if (followsOfFollowsEvents.length > 0) {
      const secondDegreePubkeys = followsOfFollowsEvents
        .flatMap(event => event.tags.filter(tag => tag[0] === 'p').map(tag => tag[1]))
        .filter((pubkey, index, self) => self.indexOf(pubkey) === index);
      setFollowsOfFollows(secondDegreePubkeys);
      logger.info(`Follows of follows: ${secondDegreePubkeys.length}`); // Debug
    }
  }, [followsOfFollowsEvents]);

  // Get post filter based on mode
  const getPostFilter = (): NDKFilter | null => {
    switch (filterMode) {
      case 'followers':
        return follows.length > 0 ? { kinds: [1], authors: follows, limit } : null;
      case 'follows':
        return followsOfFollows.length > 0 ? { kinds: [1], authors: followsOfFollows, limit } : null;
      case 'trending':
        return { kinds: [1], limit, since: Math.floor(Date.now() / 1000) - 24 * 3600 };
      default:
        return { kinds: [1], limit };
    }
  };

  // Fetch posts
  const postFilter = getPostFilter();
  const { events: postEvents, eose: postsLoaded } = useSubscribe({
    filters: postFilter ? [postFilter] : [],
    enabled: !!ndk && !!postFilter
  });

  // Fetch engagement for trendy feed
  const engagementFilter = filterMode === 'trending' ? 
    { kinds: [6, 7], limit: 1000, since: Math.floor(Date.now() / 1000) - 24 * 3600 } : null;
    
  const { events: engagementEvents } = useSubscribe({
    filters: engagementFilter ? [engagementFilter] : [],
    enabled: !!ndk && filterMode === 'trending'
  });

  // Process posts
  useEffect(() => {
    const filterPosts = async () => {
      setIsLoading(true);
      let filteredPosts: Post[] = [];
      
      try {
        for (const event of postEvents) {
          try {
            // Convert NDKEvent to Post object
            const post: Post = {
              id: event.id,
              pubkey: event.pubkey,
              content: event.content,
              created_at: event.created_at,
              tags: event.tags,
              kind: event.kind,
              sig: event.sig
            };
            
            // Check NIP-05 verification
            if (ndk) {
              const isVerified = await db.isNip05Verified(event.pubkey, ndk);
              if (isVerified) {
                filteredPosts.push(post);
              } else {
                logger.info(`Skipped post from unverified user: ${event.id}`);
              }
            }
          } catch (err) {
            logger.error(`Error checking verification for ${event.pubkey}:`, err);
          }
        }
  
        if (filterMode === 'trending') {
          const engagementCounts = engagementEvents.reduce((acc, event) => {
            const postId = event.tags.find(tag => tag[0] === 'e')?.[1];
            if (postId) acc[postId] = (acc[postId] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
  
          filteredPosts = filteredPosts
            .map(post => ({
              ...post,
              engagement: engagementCounts[post.id] || 0
            }))
            .sort((a, b) => (b.engagement || 0) - (a.engagement || 0))
            .slice(0, 50);
        }
  
        setVerifiedPosts(filteredPosts);
        logger.info(`Filtered posts: ${filteredPosts.length}`); // Debug
      } catch (err) {
        setError('Failed to filter posts: ' + (err as Error).message);
        logger.error('Error filtering posts:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    filterPosts();
  }, [postEvents, engagementEvents, ndk, filterMode]);

  // Create post function
  const createPost = async (content: string, tags?: string[][]) => {
    if (!ndk || !user) {
      setError('Not authenticated');
      return null;
    }

    try {
      const event = new NDKEvent(ndk);
      event.kind = 1;
      event.content = content;
      if (tags) {
        event.tags = [...event.tags, ...tags];
      }
      
      // Add community tags to help with discovery
      event.tags.push(['t', 'nodus']);
      
      await event.publish();
      logger.info('Published post:', event.id);
      
      // Add to local posts
      const newPost: Post = {
        id: event.id,
        pubkey: event.pubkey,
        content: event.content,
        created_at: event.created_at,
        tags: event.tags,
        kind: event.kind,
        sig: event.sig
      };
      
      setVerifiedPosts(prev => [newPost, ...prev]);
      
      return newPost;
    } catch (err) {
      setError('Failed to publish post: ' + (err as Error).message);
      logger.error('Error publishing post:', err);
      return null;
    }
  };

  return { 
    posts: verifiedPosts, 
    isLoading: isLoading || !postsLoaded, 
    error,
    createPost
  };
}