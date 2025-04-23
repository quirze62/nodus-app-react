import { ndkStore } from './ndk-config.js';
import { db } from '../db/db.js';
import { get } from 'svelte/store';
import { writable } from 'svelte/store';

// Create stores for application state
export const isLoading = writable(false);
export const error = writable(null);
export const cachedProfiles = writable(new Map());

/**
 * Get a user's profile
 * @param {string} pubkey - User's public key
 * @returns {Promise<Object|null>} - Profile data or null
 */
export const getProfile = async (pubkey) => {
  if (!pubkey) return null;
  
  console.info(`[INFO] Fetching profile for ${pubkey.substring(0, 12)}...`);
  isLoading.set(true);
  error.set(null);
  
  try {
    // Check if we have this profile in the store
    const profiles = get(cachedProfiles);
    if (profiles.has(pubkey)) {
      isLoading.set(false);
      return profiles.get(pubkey);
    }
    
    // Check if we have this profile in IndexedDB
    const cachedProfile = await db.getProfile(pubkey);
    if (cachedProfile) {
      // Update the store
      cachedProfiles.update(profiles => {
        return profiles.set(pubkey, cachedProfile);
      });
      
      isLoading.set(false);
      return cachedProfile;
    }
    
    // Fetch from network
    const ndk = get(ndkStore);
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    // Create filter for user's metadata (kind 0)
    const filter = {
      kinds: [0],
      authors: [pubkey]
    };
    
    // Use NDK to fetch event
    const profileEvent = await ndk.fetchEvent(filter);
    
    if (!profileEvent) {
      // No profile found, create a minimal one
      const minimalProfile = {
        pubkey,
        name: 'Unknown User',
        displayName: 'Unknown User',
        about: '',
        picture: '',
        updated_at: Date.now()
      };
      
      // Store the minimal profile
      await db.storeProfile(pubkey, minimalProfile);
      
      // Update the store
      cachedProfiles.update(profiles => {
        return profiles.set(pubkey, minimalProfile);
      });
      
      isLoading.set(false);
      return minimalProfile;
    }
    
    try {
      // Parse the content
      const profileData = JSON.parse(profileEvent.content);
      
      // Create a profile object
      const profile = {
        pubkey,
        ...profileData,
        updated_at: profileEvent.created_at * 1000
      };
      
      // Store in IndexedDB
      await db.storeProfile(pubkey, profile);
      
      // Update the store
      cachedProfiles.update(profiles => {
        return profiles.set(pubkey, profile);
      });
      
      isLoading.set(false);
      return profile;
    } catch (parseError) {
      console.error(`Failed to parse profile content for ${pubkey}:`, parseError);
      
      // Create a minimal profile if parsing failed
      const minimalProfile = {
        pubkey,
        name: 'Unknown User',
        displayName: 'Unknown User',
        about: '',
        picture: '',
        updated_at: Date.now()
      };
      
      // Store the minimal profile
      await db.storeProfile(pubkey, minimalProfile);
      
      // Update the store
      cachedProfiles.update(profiles => {
        return profiles.set(pubkey, minimalProfile);
      });
      
      isLoading.set(false);
      return minimalProfile;
    }
  } catch (err) {
    console.error(`Failed to get profile for ${pubkey}:`, err);
    error.set(err.message || 'Failed to get profile');
    isLoading.set(false);
    return null;
  }
};

/**
 * Update the current user's profile
 * @param {Object} profile - Profile data to update
 * @returns {Promise<boolean>} - Success status
 */
export const updateProfile = async (profile) => {
  console.info('[INFO] Updating user profile');
  isLoading.set(true);
  error.set(null);
  
  try {
    const ndk = get(ndkStore);
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    // Ensure we have a user
    const user = ndk.getUser();
    if (!user) {
      throw new Error('No authenticated user');
    }
    
    // Create a new metadata event (kind 0)
    const event = {
      kind: 0,
      content: JSON.stringify(profile)
    };
    
    // Publish the event
    const publishedEvent = await ndk.publish(event);
    
    // Update the profile in our database
    const pubkey = await user.publicKey;
    await db.storeProfile(pubkey, {
      pubkey,
      ...profile,
      updated_at: Date.now()
    });
    
    // Update the cache
    cachedProfiles.update(profiles => {
      return profiles.set(pubkey, {
        pubkey,
        ...profile,
        updated_at: Date.now()
      });
    });
    
    isLoading.set(false);
    return true;
  } catch (err) {
    console.error('Failed to update profile:', err);
    error.set(err.message || 'Failed to update profile');
    isLoading.set(false);
    return false;
  }
};

/**
 * Get a user's followers
 * @param {string} pubkey - User's public key
 * @returns {Promise<Array<string>>} - Array of follower public keys
 */
export const getFollowers = async (pubkey) => {
  if (!pubkey) return [];
  
  console.info(`[INFO] Fetching followers for ${pubkey.substring(0, 12)}...`);
  
  try {
    const ndk = get(ndkStore);
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    // Create filter for contact lists (kind 3) that include this pubkey
    const filter = {
      kinds: [3],
      '#p': [pubkey]
    };
    
    // Use NDK to fetch events
    const events = await ndk.fetchEvents(filter);
    const followerEvents = Array.from(events);
    
    // Extract follower public keys
    const followers = followerEvents.map(event => event.pubkey);
    
    return followers;
  } catch (err) {
    console.error(`Failed to get followers for ${pubkey}:`, err);
    return [];
  }
};

/**
 * Get users followed by a user
 * @param {string} pubkey - User's public key
 * @returns {Promise<Array<string>>} - Array of followed public keys
 */
export const getFollowing = async (pubkey) => {
  if (!pubkey) return [];
  
  console.info(`[INFO] Fetching following for ${pubkey.substring(0, 12)}...`);
  
  try {
    const ndk = get(ndkStore);
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    // Try to get from cache first
    const cachedFollowing = await db.getUserFollows(pubkey);
    if (cachedFollowing && cachedFollowing.length > 0) {
      return cachedFollowing;
    }
    
    // Create filter for contact lists (kind 3) by this pubkey
    const filter = {
      kinds: [3],
      authors: [pubkey],
      limit: 1 // We only need the most recent one
    };
    
    // Use NDK to fetch events
    const event = await ndk.fetchEvent(filter);
    
    if (!event) {
      return [];
    }
    
    // Extract followed public keys from the p tags
    const following = event.tags
      .filter(tag => tag[0] === 'p')
      .map(tag => tag[1]);
    
    // Store in cache
    await db.storeUserFollows(pubkey, following);
    
    return following;
  } catch (err) {
    console.error(`Failed to get following for ${pubkey}:`, err);
    return [];
  }
};

/**
 * Follow a user
 * @param {string} pubkeyToFollow - Public key of user to follow
 * @returns {Promise<boolean>} - Success status
 */
export const followUser = async (pubkeyToFollow) => {
  console.info(`[INFO] Following user: ${pubkeyToFollow.substring(0, 12)}...`);
  isLoading.set(true);
  error.set(null);
  
  try {
    const ndk = get(ndkStore);
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    // Ensure we have a user
    const user = ndk.getUser();
    if (!user) {
      throw new Error('No authenticated user');
    }
    
    const pubkey = await user.publicKey;
    
    // Get current following list
    const currentFollowing = await getFollowing(pubkey);
    
    // If already following, do nothing
    if (currentFollowing.includes(pubkeyToFollow)) {
      isLoading.set(false);
      return true;
    }
    
    // Add the new pubkey to the list
    const newFollowing = [...currentFollowing, pubkeyToFollow];
    
    // Create tags for each following
    const tags = newFollowing.map(pk => ['p', pk]);
    
    // Create a new contact list event (kind 3)
    const event = {
      kind: 3,
      content: '',
      tags
    };
    
    // Publish the event
    const publishedEvent = await ndk.publish(event);
    
    // Update our local cache
    await db.storeUserFollows(pubkey, newFollowing);
    
    isLoading.set(false);
    return true;
  } catch (err) {
    console.error(`Failed to follow user ${pubkeyToFollow}:`, err);
    error.set(err.message || 'Failed to follow user');
    isLoading.set(false);
    return false;
  }
};

/**
 * Unfollow a user
 * @param {string} pubkeyToUnfollow - Public key of user to unfollow
 * @returns {Promise<boolean>} - Success status
 */
export const unfollowUser = async (pubkeyToUnfollow) => {
  console.info(`[INFO] Unfollowing user: ${pubkeyToUnfollow.substring(0, 12)}...`);
  isLoading.set(true);
  error.set(null);
  
  try {
    const ndk = get(ndkStore);
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    // Ensure we have a user
    const user = ndk.getUser();
    if (!user) {
      throw new Error('No authenticated user');
    }
    
    const pubkey = await user.publicKey;
    
    // Get current following list
    const currentFollowing = await getFollowing(pubkey);
    
    // If not following, do nothing
    if (!currentFollowing.includes(pubkeyToUnfollow)) {
      isLoading.set(false);
      return true;
    }
    
    // Remove the pubkey from the list
    const newFollowing = currentFollowing.filter(pk => pk !== pubkeyToUnfollow);
    
    // Create tags for each following
    const tags = newFollowing.map(pk => ['p', pk]);
    
    // Create a new contact list event (kind 3)
    const event = {
      kind: 3,
      content: '',
      tags
    };
    
    // Publish the event
    const publishedEvent = await ndk.publish(event);
    
    // Update our local cache
    await db.storeUserFollows(pubkey, newFollowing);
    
    isLoading.set(false);
    return true;
  } catch (err) {
    console.error(`Failed to unfollow user ${pubkeyToUnfollow}:`, err);
    error.set(err.message || 'Failed to unfollow user');
    isLoading.set(false);
    return false;
  }
};

/**
 * Subscribe to profile updates
 * @param {Function} onProfileUpdate - Callback for profile updates
 * @returns {Function} - Unsubscribe function
 */
export const subscribeToProfiles = (onProfileUpdate) => {
  console.info('[INFO] Subscribing to profile updates');
  
  try {
    const ndk = get(ndkStore);
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    // Create filter for metadata events (kind 0)
    const filter = {
      kinds: [0]
    };
    
    // Create the subscription
    const subscription = ndk.subscribe(filter);
    
    // Handle events
    subscription.on('event', async (event) => {
      try {
        // Parse the profile data
        const profileData = JSON.parse(event.content);
        
        // Create the profile object
        const profile = {
          pubkey: event.pubkey,
          ...profileData,
          updated_at: event.created_at * 1000
        };
        
        // Store in cache
        await db.storeProfile(event.pubkey, profile);
        
        // Update the store
        cachedProfiles.update(profiles => {
          return profiles.set(event.pubkey, profile);
        });
        
        // Call the callback
        onProfileUpdate(profile);
      } catch (err) {
        console.error('Failed to process profile update:', err);
      }
    });
    
    // Return unsubscribe function
    return () => {
      console.info('[INFO] Unsubscribing from profile updates');
      subscription.stop();
    };
  } catch (err) {
    console.error('Failed to subscribe to profiles:', err);
    
    // Return no-op function
    return () => {};
  }
};