import { useState, useEffect } from 'react';
import { NDKEvent, NDKUser, NDKFilter, NDKSubscriptionOptions, NDKSubscription } from '@nostr-dev-kit/ndk';
import { useNdk } from '../contexts/NdkContext';
import { useAuth } from '../contexts/AuthContext';
import logger from '../lib/logger';
import { NostrEvent, EventKind } from '../lib/nostr';
import { db } from '../lib/db';
import { isNIP05Verified, isPersonallyApproved } from '../lib/ndk';
import { FeedFilters, DEFAULT_FILTERS } from '@/components/feed/FeedFilters';

// Helper function to check if a user is a valid Nodus network member
async function isValidNodusMember(user: NDKUser): Promise<boolean> {
  try {
    // First check if the user has a NIP-05 identifier (base requirement)
    if (!user.profile?.nip05) {
      return false;
    }
    
    // Next, check if they're verified via actual NIP-05 protocol
    // (the isNIP05Verified function actually does a DNS lookup)
    const hasValidNIP05 = await isNIP05Verified(user.pubkey);
    if (!hasValidNIP05) {
      return false;
    }
    
    // Finally, check if they're in our allowed list
    // In a production app, this would check against a database or other source
    const isApproved = await isPersonallyApproved(user.pubkey);
    
    return isApproved;
  } catch (error) {
    logger.error("Error validating Nodus member:", error);
    return false;
  }
}

// Hook for fetching and working with posts
export function useNodusPosts(limit: number = 50, initialFilters: Partial<FeedFilters> = {}) {
  const [filters, setFilters] = useState<FeedFilters>({ ...DEFAULT_FILTERS, ...initialFilters });
  const { ndk, user: ndkUser } = useNdk();
  const { user: authUser } = useAuth();
  const [posts, setPosts] = useState<NostrEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifiedPosts, setVerifiedPosts] = useState<NostrEvent[]>([]);
  
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
  
  // State to track users the current user is following and followers
  const [followingList, setFollowingList] = useState<string[]>([]);
  const [followersList, setFollowersList] = useState<string[]>([]);
  const [usersWithReactions, setUsersWithReactions] = useState<{[key: string]: number}>({});
  
  // Function to fetch following list and followers from NDK
  useEffect(() => {
    // Fetch following list when user is authenticated
    const fetchSocialGraph = async () => {
      if (!ndk || !authUser) return;
      
      try {
        // 1. Fetch who the user follows (users that appear in the user's contact list)
        logger.info('Fetching users that the current user follows');
        
        // Create a filter to get the contact list event (kind 3)
        const followingFilter: NDKFilter = {
          kinds: [EventKind.CONTACTS],
          authors: [authUser.publicKey]
        };
        
        const contactEvents = await ndk.fetchEvents(followingFilter);
        const followingPubkeys: string[] = [];
        
        contactEvents.forEach(event => {
          // Extract pubkeys from p tags
          const pubkeys = event.tags
            .filter(tag => tag[0] === 'p')
            .map(tag => tag[1]);
          
          followingPubkeys.push(...pubkeys);
        });
        
        setFollowingList(followingPubkeys);
        logger.info(`Loaded ${followingPubkeys.length} followed users`);
        
        // 2. Fetch followers (users who have the current user in their contact list)
        logger.info('Fetching users that follow the current user');
        
        const followerFilter: NDKFilter = {
          kinds: [EventKind.CONTACTS],
          '#p': [authUser.publicKey]
        };
        
        const followerEvents = await ndk.fetchEvents(followerFilter);
        const followerPubkeys: string[] = [];
        
        followerEvents.forEach(event => {
          // Get the author of each contact list that mentions the current user
          followerPubkeys.push(event.pubkey);
        });
        
        setFollowersList(followerPubkeys);
        logger.info(`Loaded ${followerPubkeys.length} followers`);
        
        // 3. Get trending users (users with many reactions)
        logger.info('Identifying trending content creators');
        
        const reactionCounts: {[key: string]: number} = {};
        
        // Get recent reaction events
        const reactionFilter: NDKFilter = {
          kinds: [EventKind.REACTION],
          limit: 500
        };
        
        const reactionEvents = await ndk.fetchEvents(reactionFilter);
        
        reactionEvents.forEach(event => {
          // Find the author of the post being reacted to
          const eventTag = event.tags.find(tag => tag[0] === 'e');
          const pubkeyTag = event.tags.find(tag => tag[0] === 'p');
          
          if (eventTag && pubkeyTag) {
            const targetPubkey = pubkeyTag[1];
            reactionCounts[targetPubkey] = (reactionCounts[targetPubkey] || 0) + 1;
          }
        });
        
        setUsersWithReactions(reactionCounts);
        logger.info(`Processed reactions for ${Object.keys(reactionCounts).length} users`);
        
      } catch (err) {
        logger.error('Error fetching social graph', err);
      }
    };
    
    fetchSocialGraph();
  }, [ndk, authUser]);
  
  // Function to apply filters to posts
  const applyFilters = (posts: NostrEvent[]): NostrEvent[] => {
    if (!posts || posts.length === 0) return [];
    
    return posts.filter(post => {
      // Search term filter
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        const content = post.content.toLowerCase();
        if (!content.includes(term)) {
          return false;
        }
      }
      
      // Tags filter
      if (filters.tags.length > 0) {
        const postTags = post.tags.filter(tag => tag[0] === 't').map(tag => tag[1]);
        const hasMatchingTag = filters.tags.some(filterTag => 
          postTags.includes(filterTag) || post.content.toLowerCase().includes(`#${filterTag.toLowerCase()}`)
        );
        
        if (!hasMatchingTag) {
          return false;
        }
      }
      
      // Reposts filter
      if (!filters.includeReposts && post.kind === EventKind.REPOST) {
        return false;
      }
      
      // Mentions filter (approximation - looking for p tags)
      if (!filters.includeMentions && post.tags.some(tag => tag[0] === 'p')) {
        return false;
      }
      
      // Filter by followed/following/trending
      // At least one of these filters must match if any is enabled
      const socialFiltersEnabled = filters.showOnlyFollowed || filters.showOnlyFollowing || filters.showTrending;
      
      if (socialFiltersEnabled) {
        let matchesSocialFilter = false;
        
        // Check each enabled filter
        if (filters.showOnlyFollowed && authUser) {
          // Check if post is from a follower (someone who follows the current user)
          const isFromFollower = post.pubkey && followersList.includes(post.pubkey);
          if (isFromFollower) {
            logger.debug(`Post from follower: ${post.pubkey}`);
            matchesSocialFilter = true;
          }
        }
        
        if (filters.showOnlyFollowing && authUser) {
          // Check if post is from someone the user follows
          const isFromFollowing = post.pubkey && followingList.includes(post.pubkey);
          if (isFromFollowing) {
            logger.debug(`Post from following: ${post.pubkey}`);
            matchesSocialFilter = true;
          }
        }
        
        if (filters.showTrending) {
          // Implementation for trending posts - using reaction counts
          const hasMany = post.pubkey && usersWithReactions[post.pubkey] && usersWithReactions[post.pubkey] > 1;
          
          // Alternative detection - posts with many tags or mentions
          const hasMultipleTags = post.tags.filter(tag => tag[0] === 't' || tag[0] === 'p').length > 2;
          
          if (hasMany || hasMultipleTags) {
            logger.debug(`Trending post: ${post.pubkey} with ${usersWithReactions[post.pubkey] || 0} reactions`);
            matchesSocialFilter = true;
          }
        }
        
        if (!matchesSocialFilter) return false;
      }
      
      return true;
    });
  };
  
  // Update filtered posts when filters change or when following/follower lists change
  useEffect(() => {
    if (verifiedPosts.length > 0) {
      const filtered = applyFilters(verifiedPosts);
      setPosts(filtered);
      logger.info(`Applied filters: ${Object.keys(filters).filter(k => filters[k] === true).join(', ')}`);
      logger.info(`Showing ${filtered.length} of ${verifiedPosts.length} posts after filtering`);
    }
  }, [filters, followingList, followersList, usersWithReactions]);
  
  // Set up subscription to posts
  useEffect(() => {
    if (!ndk) return;
    
    setIsLoading(true);
    logger.info(`Fetching up to ${limit} posts from Nostr network`);
    
    // Additional filter parameters based on user selections
    let ndkFilter: NDKFilter = {
      kinds: [EventKind.TEXT_NOTE],
      limit
    };
    
    // For trending filter, we could fetch posts with a larger number of reactions
    // This would require additional implementation with NDK
    
    // Start with posts from database
    db.getEventsByKind(EventKind.TEXT_NOTE, limit)
      .then((dbEvents: NostrEvent[]) => {
        if (dbEvents.length > 0) {
          logger.info(`Loaded ${dbEvents.length} posts from local database`);
          const sortedDbEvents = dbEvents.sort((a: NostrEvent, b: NostrEvent) => b.created_at - a.created_at);
          setVerifiedPosts(sortedDbEvents);
          setPosts(applyFilters(sortedDbEvents));
        }
      })
      .catch((err: Error) => {
        logger.error('Error loading posts from database', err);
        setError('Failed to load posts from database: ' + err.message);
      });
    
    // Create subscription
    const subscription = ndk.subscribe(ndkFilter, options);
    const events: NostrEvent[] = [];
    
    // Handle events as they come in
    subscription.on('event', async (ndkEvent: NDKEvent) => {
      try {
        const event = convertNDKEventToNostrEvent(ndkEvent);
        
        // Check for verified users (has NIP-05)
        // Get profile for author if we don't already have it
        const user = ndk.getUser({ pubkey: event.pubkey });
        try {
          await user.fetchProfile();
          
          // Only allow posts from users with NIP-05 verification
          if (user.profile?.nip05) {
            // Extra verification step - check if user is part of our closed network
            const isVerified = await isValidNodusMember(user);
            
            if (isVerified) {
              logger.info(`Accepted post from verified user: ${user.profile.nip05}`);
              events.push(event);
              
              // Store in database
              db.storeEvent(event).catch((err: Error) => {
                logger.error('Error storing event in database', err);
              });
              
              // Add cluster tag for Matryoshka testing if not present
              if (!event.tags.some(tag => tag[0] === 'cluster')) {
                event.tags.push(['cluster', 'city1']);
              }
              
              // Sort and update state
              const sortedEvents = [...events].sort((a: NostrEvent, b: NostrEvent) => b.created_at - a.created_at);
              setVerifiedPosts(sortedEvents);
              setPosts(applyFilters(sortedEvents));
            } else {
              logger.info(`Skipped post from user with NIP-05 but not in approved network: ${user.profile.nip05}`);
            }
          } else {
            logger.info(`Skipped post from unverified user: ${event.pubkey}`);
          }
        } catch (profileError) {
          logger.warn(`Failed to fetch profile for ${event.pubkey}: ${profileError}`);
          logger.info(`Skipped post due to profile fetch failure: ${event.pubkey}`);
        }
      } catch (err) {
        logger.error('Error processing event', err);
        setError('Error processing event: ' + (err as Error).message);
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
  
  // Function to publish to door relays for Matryoshka implementation
  const publishToDoorRelays = async (event: NDKEvent) => {
    try {
      if (!ndk || !ndk.pool) {
        setError('NDK pool not initialized');
        return false;
      }
      
      // Find door relays among connected relays
      const doorRelays = Array.from(ndk.pool.relays.values()).filter(relay => 
        relay.url === 'wss://relay.mynodus.com' || 
        relay.url === 'wss://relay.damus.io'
      );
      
      if (doorRelays.length === 0) {
        logger.error('No door relays available');
        setError('No door relays available');
        return false;
      }
      
      // Publish to door relays
      await Promise.all(doorRelays.map(relay => relay.publish(event)));
      return true;
    } catch (err) {
      logger.error('Error publishing to door relays', err);
      return false;
    }
  };

  // Function to create a new post
  const createPost = async (content: string, tags: string[][] = []): Promise<NostrEvent | null> => {
    if (!ndk) {
      setError('NDK not initialized');
      return null;
    }
    
    if (!ndk.signer || !authUser) {
      setError('Authentication required to create posts');
      logger.error('Attempted to create post without authentication');
      return null;
    }
    
    // Validate if the user is a valid Nodus member
    try {
      const ndkCurrentUser = ndk.getUser({ pubkey: authUser.publicKey });
      await ndkCurrentUser.fetchProfile();
      
      const isValid = await isValidNodusMember(ndkCurrentUser);
      if (!isValid) {
        setError('Only verified Nodus members can post');
        logger.error('Non-verified user attempted to create post');
        return null;
      }
    } catch (err) {
      logger.error('Error verifying user status', err);
      setError('Failed to verify user status');
      return null;
    }
    
    try {
      const event = new NDKEvent(ndk);
      event.kind = EventKind.TEXT_NOTE;
      event.content = content;
      event.created_at = Math.floor(Date.now() / 1000);
      
      // Add cluster tag for Matryoshka testing
      const updatedTags = [...tags];
      if (!updatedTags.some(tag => tag[0] === 'cluster')) {
        updatedTags.push(['cluster', 'city1']);
      }
      event.tags = updatedTags;
      
      await event.sign();
      
      // Try publishing to door relays first
      const doorPublishSuccess = await publishToDoorRelays(event);
      if (!doorPublishSuccess) {
        // Fall back to regular publish
        await event.publish();
      }
      
      const newPost = convertNDKEventToNostrEvent(event);
      
      // Store in local database
      await db.storeEvent(newPost);
      
      // Update state (add to beginning as it's the newest)
      setPosts(prevPosts => [newPost, ...prevPosts]);
      
      return newPost;
    } catch (err: any) {
      logger.error('Error creating post', err);
      setError('Failed to create post: ' + err.message);
      return null;
    }
  };
  
  // Function to like a post (create a reaction)
  const likePost = async (postId: string, postPubkey: string): Promise<NostrEvent | null> => {
    if (!ndk) {
      setError('NDK not initialized');
      return null;
    }
    
    if (!ndk.signer || !authUser) {
      setError('Authentication required to like posts');
      logger.error('Attempted to like post without authentication');
      return null;
    }
    
    // Validate if the user is a valid Nodus member
    try {
      const ndkCurrentUser = ndk.getUser({ pubkey: authUser.publicKey });
      await ndkCurrentUser.fetchProfile();
      
      const isValid = await isValidNodusMember(ndkCurrentUser);
      if (!isValid) {
        setError('Only verified Nodus members can like posts');
        logger.error('Non-verified user attempted to like a post');
        return null;
      }
    } catch (err) {
      logger.error('Error verifying user status for like', err);
      setError('Failed to verify user status');
      return null;
    }
    
    try {
      logger.info(`Creating reaction for post ${postId}`);
      
      const event = new NDKEvent(ndk);
      event.kind = EventKind.REACTION;
      event.content = '+'; // "+" is a like in Nostr
      event.created_at = Math.floor(Date.now() / 1000);
      event.tags = [
        ['e', postId], // The event being reacted to
        ['p', postPubkey], // The author of the original event
        ['cluster', 'city1'] // Add cluster tag for Matryoshka
      ];
      
      await event.sign();
      
      // Try publishing to door relays first
      const doorPublishSuccess = await publishToDoorRelays(event);
      if (!doorPublishSuccess) {
        // Fall back to regular publish
        await event.publish();
      }
      
      logger.info('Successfully liked post');
      
      const reaction = convertNDKEventToNostrEvent(event);
      
      // Store in local DB
      await db.storeEvent(reaction);
      
      return reaction;
    } catch (err) {
      logger.error('Error liking post', err);
      setError('Failed to like post: ' + (err as Error).message);
      return null;
    }
  };
  
  // Function to repost a post
  const repostPost = async (postId: string, postPubkey: string): Promise<NostrEvent | null> => {
    if (!ndk) {
      setError('NDK not initialized');
      return null;
    }
    
    if (!ndk.signer || !authUser) {
      setError('Authentication required to repost');
      logger.error('Attempted to repost without authentication');
      return null;
    }
    
    // Validate if the user is a valid Nodus member
    try {
      const ndkCurrentUser = ndk.getUser({ pubkey: authUser.publicKey });
      await ndkCurrentUser.fetchProfile();
      
      const isValid = await isValidNodusMember(ndkCurrentUser);
      if (!isValid) {
        setError('Only verified Nodus members can repost');
        logger.error('Non-verified user attempted to repost');
        return null;
      }
    } catch (err) {
      logger.error('Error verifying user status for repost', err);
      setError('Failed to verify user status');
      return null;
    }
    
    try {
      logger.info(`Creating repost for event ${postId}`);
      
      const event = new NDKEvent(ndk);
      event.kind = EventKind.REPOST;
      event.content = ''; // Repost events typically have empty content
      event.created_at = Math.floor(Date.now() / 1000);
      event.tags = [
        ['e', postId], // The event being reposted
        ['p', postPubkey], // The author of the original event
        ['cluster', 'city1'] // Add cluster tag for Matryoshka
      ];
      
      await event.sign();
      
      // Try publishing to door relays first
      const doorPublishSuccess = await publishToDoorRelays(event);
      if (!doorPublishSuccess) {
        // Fall back to regular publish
        await event.publish();
      }
      
      logger.info('Successfully reposted');
      
      const repost = convertNDKEventToNostrEvent(event);
      
      // Store in local DB
      await db.storeEvent(repost);
      
      return repost;
    } catch (err) {
      logger.error('Error reposting', err);
      setError('Failed to repost: ' + (err as Error).message);
      return null;
    }
  };
  
  // Function to reply to a post (comment)
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
    
    if (!ndk.signer || !authUser) {
      setError('Authentication required to reply');
      logger.error('Attempted to reply without authentication');
      return null;
    }
    
    // Validate if the user is a valid Nodus member
    try {
      const ndkCurrentUser = ndk.getUser({ pubkey: authUser.publicKey });
      await ndkCurrentUser.fetchProfile();
      
      const isValid = await isValidNodusMember(ndkCurrentUser);
      if (!isValid) {
        setError('Only verified Nodus members can comment on posts');
        logger.error('Non-verified user attempted to comment on a post');
        return null;
      }
    } catch (err) {
      logger.error('Error verifying user status for comment', err);
      setError('Failed to verify user status');
      return null;
    }
    
    try {
      logger.info(`Creating reply to post ${postId}`);
      
      const event = new NDKEvent(ndk);
      event.kind = EventKind.TEXT_NOTE;
      event.content = content;
      event.created_at = Math.floor(Date.now() / 1000);
      
      // Start with basic tags for the direct parent
      const tags = [
        ['e', postId, '', 'reply'], // The event being replied to
        ['p', postPubkey], // The author of that event
        ['cluster', 'city1'] // Add cluster tag for Matryoshka
      ];
      
      // Add root tag if this is a reply to a reply (thread)
      if (rootId && rootId !== postId) {
        tags.push(['e', rootId, '', 'root']);
      }
      
      // Add any additional tags
      event.tags = [...tags, ...additionalTags];
      
      await event.sign();
      
      // Try publishing to door relays first
      const doorPublishSuccess = await publishToDoorRelays(event);
      if (!doorPublishSuccess) {
        // Fall back to regular publish
        await event.publish();
      }
      
      logger.info('Successfully replied to post');
      
      const reply = convertNDKEventToNostrEvent(event);
      
      // Store in local DB
      await db.storeEvent(reply);
      
      return reply;
    } catch (err) {
      logger.error('Error replying to post', err);
      setError('Failed to send reply: ' + (err as Error).message);
      return null;
    }
  };
  
  return {
    posts,
    verifiedPosts,
    isLoading,
    error,
    filters,
    setFilters,
    createPost,
    likePost,
    repostPost,
    replyToPost,
    commentPost: replyToPost, // Alias for replyToPost for more intuitive naming
    isAuthenticated: !!ndk?.signer && !!authUser
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