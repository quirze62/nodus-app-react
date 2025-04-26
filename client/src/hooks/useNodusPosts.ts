import { useState, useEffect } from 'react';
import { NDKEvent, NDKUser, NDKFilter, NDKSubscriptionOptions, NDKSubscription } from '@nostr-dev-kit/ndk';
import { useNdk } from '../contexts/NdkContext';
import { useAuth } from '../contexts/AuthContext';
import logger from '../lib/logger';
import { NostrEvent, EventKind } from '../lib/nostr';
import { db } from '../lib/db';
import { isNIP05Verified, isPersonallyApproved, publishNote } from '../lib/ndk';
import { FeedFilters, DEFAULT_FILTERS, FilterMode } from '@/components/feed/FeedFilters';

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
export function useNodusPosts(limit: number = 50, initialFilters: Partial<FeedFilters> = {}, filterMode: FilterMode = 'all') {
  const [filters, setFilters] = useState<FeedFilters>({ ...DEFAULT_FILTERS, ...initialFilters });
  const { ndk, user: ndkUser } = useNdk();
  const { user: authUser } = useAuth();
  const [posts, setPosts] = useState<NostrEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifiedPosts, setVerifiedPosts] = useState<NostrEvent[]>([]);
  
  // State for social graph tracking
  const [followingList, setFollowingList] = useState<string[]>([]);
  const [followersList, setFollowersList] = useState<string[]>([]);
  const [followsOfFollows, setFollowsOfFollows] = useState<string[]>([]);
  const [usersWithReactions, setUsersWithReactions] = useState<{[key: string]: number}>({});
  
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
  
  // Function to fetch following list and followers from NDK
  useEffect(() => {
    // Fetch following list when user is authenticated
    const fetchSocialGraph = async () => {
      if (!ndk || !authUser) return;
      
      try {
        logger.info('Fetching social graph data...');
        
        // 1. FOLLOWS: Get users the current user follows (from contact list)
        logger.info('Fetching users that the current user follows');
        
        // Create a subscription to get the most recent contact list event (kind 3)
        const followingFilter: NDKFilter = {
          kinds: [EventKind.CONTACTS],
          authors: [authUser.publicKey]
        };
        
        logger.debug(`Fetching follows with filter: ${JSON.stringify(followingFilter)}`);
        
        // First try to get the most recent contact list
        const subscription = ndk.subscribe(followingFilter, { closeOnEose: true });
        const followingPubkeys: string[] = [];
        let contactsEvent: NDKEvent | null = null;
        
        subscription.on('event', (event: NDKEvent) => {
          // We only need the most recent contact list
          if (!contactsEvent || event.created_at > contactsEvent.created_at) {
            contactsEvent = event;
          }
        });
        
        await new Promise<void>((resolve) => {
          subscription.on('eose', () => {
            if (contactsEvent) {
              logger.info(`Found contact list with ${contactsEvent.tags.length} tags`);
              // Extract pubkeys from p tags
              const pubkeys = contactsEvent.tags
                .filter(tag => tag[0] === 'p')
                .map(tag => tag[1]);
              
              followingPubkeys.push(...pubkeys);
              logger.info(`Loaded ${followingPubkeys.length} followed users`);
            } else {
              logger.info('No contact list found');
            }
            resolve();
          });
        });
        
        setFollowingList(followingPubkeys);
        
        // 2. FOLLOWERS: Users who follow the current user
        logger.info('Fetching users that follow the current user');
        
        const followerFilter: NDKFilter = {
          kinds: [EventKind.CONTACTS],
          '#p': [authUser.publicKey]
        };
        
        logger.debug(`Fetching followers with filter: ${JSON.stringify(followerFilter)}`);
        
        const followerSubscription = ndk.subscribe(followerFilter, { closeOnEose: true });
        const followerPubkeys: string[] = [];
        
        followerSubscription.on('event', (event: NDKEvent) => {
          // Get the author of each contact list that mentions the current user
          if (!followerPubkeys.includes(event.pubkey)) {
            followerPubkeys.push(event.pubkey);
          }
        });
        
        await new Promise<void>((resolve) => {
          followerSubscription.on('eose', () => {
            logger.info(`Loaded ${followerPubkeys.length} followers`);
            resolve();
          });
        });
        
        setFollowersList(followerPubkeys);
        
        // 3. TRENDING: Get posts with high engagement
        logger.info('Identifying trending content');
        
        const reactionCounts: {[key: string]: number} = {};
        const eventCounts: {[key: string]: number} = {};
        
        // Get recent reaction events
        const reactionFilter: NDKFilter = {
          kinds: [EventKind.REACTION],
          limit: 500,
          since: Math.floor(Date.now() / 1000) - 24 * 60 * 60  // Last 24 hours
        };
        
        logger.debug(`Fetching reactions with filter: ${JSON.stringify(reactionFilter)}`);
        
        const reactionSubscription = ndk.subscribe(reactionFilter, { closeOnEose: true });
        
        reactionSubscription.on('event', (event: NDKEvent) => {
          // Find the post being reacted to
          const eventTag = event.tags.find(tag => tag[0] === 'e');
          const pubkeyTag = event.tags.find(tag => tag[0] === 'p');
          
          if (eventTag && pubkeyTag) {
            const eventId = eventTag[1];
            const targetPubkey = pubkeyTag[1];
            
            // Count reactions by event
            eventCounts[eventId] = (eventCounts[eventId] || 0) + 1;
            
            // Count reactions by author
            reactionCounts[targetPubkey] = (reactionCounts[targetPubkey] || 0) + 1;
          }
        });
        
        await new Promise<void>((resolve) => {
          reactionSubscription.on('eose', () => {
            logger.info(`Processed reactions for ${Object.keys(reactionCounts).length} users and ${Object.keys(eventCounts).length} events`);
            resolve();
          });
        });
        
        setUsersWithReactions(reactionCounts);
        
        logger.info('Social graph loading complete');
        
      } catch (err) {
        logger.error('Error fetching social graph', err);
        setError('Failed to load social graph: ' + (err as Error).message);
      }
    };
    
    fetchSocialGraph();
  }, [ndk, authUser]);
  
  // Function to apply filters to posts
  const applyFilters = (posts: NostrEvent[]): NostrEvent[] => {
    if (!posts || posts.length === 0) return [];
    
    // Apply filters based on the filterMode parameter too
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
      
      // Now check the specific filterMode passed to the hook
      if (filterMode !== 'all') {
        // If we're using a specific filter mode, apply that filter
        switch (filterMode) {
          case 'followers':
            // Show posts from users who follow the current user
            return authUser && post.pubkey && followersList.includes(post.pubkey);
            
          case 'follows':
            // Show posts from users the current user follows
            return authUser && post.pubkey && followingList.includes(post.pubkey);
            
          case 'trendy':
            // Show posts with high engagement or multiple tags
            const hasManyReactions = post.pubkey && usersWithReactions[post.pubkey] && usersWithReactions[post.pubkey] > 1;
            const hasMultipleTags = post.tags.filter(tag => tag[0] === 't' || tag[0] === 'p').length > 2;
            return hasManyReactions || hasMultipleTags;
        }
      }
      
      // Also apply filters based on selected filter checkboxes
      // These can work independently or along with the filterMode
      if (filters.showOnlyFollowed || filters.showOnlyFollowing || filters.showTrending) {
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
      
      // Create a readable description of active filters
      const activeFilters = [];
      if (filterMode !== 'all') activeFilters.push(filterMode);
      if (filters.showOnlyFollowed) activeFilters.push('followers');
      if (filters.showOnlyFollowing) activeFilters.push('following');
      if (filters.showTrending) activeFilters.push('trending');
      if (filters.searchTerm) activeFilters.push(`search:"${filters.searchTerm}"`);
      if (filters.tags.length > 0) activeFilters.push(`tags:[${filters.tags.join(', ')}]`);
      if (!filters.includeReposts) activeFilters.push('no-reposts');
      if (!filters.includeMentions) activeFilters.push('no-mentions');
      
      logger.info(`Applied filters: ${activeFilters.join(', ') || 'none'}`);
      logger.info(`Showing ${filtered.length} of ${verifiedPosts.length} posts after filtering`);
    }
  }, [filters, filterMode, followingList, followersList, usersWithReactions, verifiedPosts]);
  
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
        logger.error('Error loading posts from database:', err);
      })
      .finally(() => {
        // Then fetch from the network for fresh data
        // We'll combine this with what we have
        const subscription = ndk.subscribe(ndkFilter, options);
        
        subscription.on('event', async (ndkEvent: NDKEvent) => {
          // Verify the author of the post
          const user = ndk.getUser({ pubkey: ndkEvent.pubkey });
          const isValid = await isValidNodusMember(user);
          
          if (isValid) {
            logger.info(`Accepted post from verified user: ${user.profile?.nip05 || user.pubkey}`);
            
            // Convert NDK event to NostrEvent
            const event = convertNDKEventToNostrEvent(ndkEvent);
            
            // Store in database
            db.storeEvent(event).catch((err: Error) => {
              logger.error('Error storing event in database:', err);
            });
            
            // Update state
            setVerifiedPosts(prev => {
              // Don't add duplicates
              if (prev.some(p => p.id === event.id)) {
                return prev;
              }
              
              // Add the new post and re-sort
              const newEvents = [...prev, event];
              const sortedEvents = [...newEvents].sort((a: NostrEvent, b: NostrEvent) => b.created_at - a.created_at);
              return sortedEvents;
            });
          } else {
            logger.info(`Skipped post from unverified user: ${ndkEvent.pubkey}`);
          }
        });
        
        subscription.on('eose', () => {
          setIsLoading(false);
          logger.info('Received all posts from subscribed relays');
        });
        
        return () => {
          subscription.stop();
        };
      });
  }, [ndk, limit, filterMode]); // Add filterMode as a dependency
  
  // Function to create a post
  const createPost = async (content: string): Promise<NostrEvent | null> => {
    if (!ndk || !authUser) {
      setError('Not authenticated');
      return null;
    }
    
    try {
      // Create a new post event
      return await publishNote(content);
    } catch (err) {
      const error = err as Error;
      logger.error('Error creating post:', error);
      setError(`Failed to create post: ${error.message}`);
      return null;
    }
  };
  
  // Function to publish post to door relays
  const publishToDoorRelays = async (event: NDKEvent) => {
    // This would be where we implement advanced relay strategies
    // such as the Matryoshka approach
    logger.info('Publishing to door relays');
  };
  
  // Return the hook interface
  return {
    posts,
    isLoading,
    error,
    createPost,
    filters,
    setFilters,
    filterMode
  };
}

// Helper function to convert NDK event to our app format
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