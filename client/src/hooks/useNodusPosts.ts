// client/src/hooks/useNodusPosts.ts
import { useNDK, useSubscribe } from '@nostr-dev-kit/ndk-hooks';
import { useState, useEffect, useContext } from 'react';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { AuthContext } from '@/contexts/AuthContext';
import logger from '../lib/logger';
import { FilterMode } from '@/components/feed/FeedFilters';

interface Post extends NDKEvent {
  id: string;
  pubkey: string;
  content: string;
  created_at: number;
  tags: string[][];
  engagement?: number;
}

export function useNodusPosts(filterMode: FilterMode = 'all', limit: number = 50) {
  const { ndk } = useNDK();
  const { user } = useContext(AuthContext);
  const [verifiedPosts, setVerifiedPosts] = useState<Post[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user follows
  const [follows, setFollows] = useState<string[]>([]);
  const { events: followEvents } = useSubscribe({
    filter: { kinds: [3], authors: user ? [user.publicKey] : [] },
    enabled: !!ndk && !!user
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
  const { events: followsOfFollowsEvents } = useSubscribe({
    filter: { kinds: [3], authors: follows },
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
  const getPostFilter = () => {
    switch (filterMode) {
      case 'followers':
        return { kinds: [1], authors: follows, limit: 50 };
      case 'follows':
        return { kinds: [1], authors: followsOfFollows, limit: 50 };
      case 'trending':
        return { kinds: [1], limit: 50, since: Math.floor(Date.now() / 1000) - 24 * 3600 };
      default:
        return { kinds: [1], limit: 50 };
    }
  };

  // Fetch posts
  const { events: postEvents, loading: postsLoading } = useSubscribe({
    filter: getPostFilter(),
    enabled: !!ndk && (filterMode !== 'follows' || followsOfFollows.length > 0)
  });

  // Fetch engagement for trendy feed
  const { events: engagementEvents } = useSubscribe({
    filter: { kinds: [6, 7], limit: 1000, since: Math.floor(Date.now() / 1000) - 24 * 3600 },
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
            const isVerified = await db.isNip05Verified(event.pubkey, ndk);
            if (isVerified) {
              filteredPosts.push(event as Post);
            } else {
              logger.info(`Skipped post from unverified user: ${event.pubkey}`);
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
      const newPost = event as Post;
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
    isLoading: isLoading || postsLoading, 
    error,
    createPost
  };
}