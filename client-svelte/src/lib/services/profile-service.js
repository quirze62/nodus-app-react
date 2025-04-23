import { getNDK, initNDK } from './ndk-config';
import { NDKKind, NDKEvent } from '@nostr-dev-kit/ndk';
import { db } from '../db/db';
import { auth } from '../stores/auth';
import { toast } from '../stores/toast';

// Default cache timeout (1 hour)
const CACHE_TIMEOUT = 60 * 60 * 1000;

// Log function
function log(message, level = 'info') {
  const logPrefix = `[${level.toUpperCase()}]`;
  console[level](`${logPrefix} ${message}`);
}

// Fetch a profile for a pubkey
export async function fetchProfile(pubkey) {
  if (!pubkey) return null;
  
  try {
    log(`Fetching profile for ${pubkey}`);
    
    // Check if we have a cached profile that's still fresh
    const cachedProfile = await db.getProfile(pubkey);
    
    if (cachedProfile && cachedProfile.updated_at) {
      const now = Date.now();
      const cacheAge = now - cachedProfile.updated_at;
      
      // If cache is fresh, return it
      if (cacheAge < CACHE_TIMEOUT) {
        return cachedProfile;
      }
    }
    
    // Fetch from network
    const ndk = await initNDK();
    
    // Create a filter for metadata (kind 0)
    const filter = {
      kinds: [NDKKind.Metadata],
      authors: [pubkey],
      limit: 1
    };
    
    // Get the most recent profile event
    const profileEvents = await ndk.fetchEvents(filter);
    const profileEvent = [...profileEvents][0];
    
    if (profileEvent) {
      let profile;
      
      try {
        // Parse the content as JSON
        profile = JSON.parse(profileEvent.content);
      } catch (err) {
        console.error(`Failed to parse profile content for ${pubkey}:`, err);
        
        // If we have a cached profile, return that instead
        if (cachedProfile) {
          return cachedProfile;
        }
        
        return null;
      }
      
      // Store in database
      await db.storeProfile(pubkey, profile);
      
      // Update the current user's profile if it's their profile
      if ($auth.isAuthenticated && $auth.user.pubkey === pubkey) {
        auth.updateUserProfile(profile);
      }
      
      return { pubkey, ...profile };
    } else if (cachedProfile) {
      // If we have a cached profile but couldn't fetch a new one, return the cached one
      return cachedProfile;
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching profile for ${pubkey}:`, error);
    
    // Try to use cached profile
    const cachedProfile = await db.getProfile(pubkey);
    
    if (cachedProfile) {
      return cachedProfile;
    }
    
    return null;
  }
}

// Update a profile
export async function updateProfile(profile) {
  try {
    // Check if user is authenticated
    const user = auth.get().user;
    if (!user || !user.privateKey) {
      throw new Error('Not authenticated');
    }
    
    // Create a new NDK event
    const ndk = await initNDK();
    const event = new NDKEvent(ndk);
    
    // Set the kind (0 = metadata)
    event.kind = NDKKind.Metadata;
    
    // Set the content (stringify the profile)
    event.content = JSON.stringify(profile);
    
    // Sign and publish the event
    await event.sign(user.privateKey);
    await event.publish();
    
    // Store in local DB
    await db.storeProfile(user.pubkey, profile);
    
    // Update the current user's profile
    auth.updateUserProfile(profile);
    
    toast.success('Profile updated successfully!');
    return true;
  } catch (error) {
    console.error('Error updating profile:', error);
    toast.error(`Failed to update profile: ${error.message}`);
    throw error;
  }
}

// Get followers of a user
export async function getFollowers(pubkey) {
  try {
    // Fetch from network
    const ndk = await initNDK();
    
    // Create a filter for follows (kind 3 = contacts)
    const filter = {
      kinds: [NDKKind.Contacts],
      "#p": [pubkey]
    };
    
    // Get the follow events
    const followEvents = await ndk.fetchEvents(filter);
    
    // Extract the authors of the follow events
    const followers = [...followEvents].map(event => event.pubkey);
    
    return followers;
  } catch (error) {
    console.error(`Error getting followers for ${pubkey}:`, error);
    return [];
  }
}

// Get users that a user follows
export async function getFollowing(pubkey) {
  try {
    // Fetch from network
    const ndk = await initNDK();
    
    // Create a filter for follows (kind 3 = contacts)
    const filter = {
      kinds: [NDKKind.Contacts],
      authors: [pubkey],
      limit: 1
    };
    
    // Get the most recent contacts list
    const followEvents = await ndk.fetchEvents(filter);
    const followEvent = [...followEvents][0];
    
    if (followEvent) {
      // Extract the p tags from the event
      const following = followEvent.tags
        .filter(tag => tag[0] === 'p')
        .map(tag => tag[1]);
      
      return following;
    }
    
    return [];
  } catch (error) {
    console.error(`Error getting following for ${pubkey}:`, error);
    return [];
  }
}

// Follow a user
export async function followUser(pubkeyToFollow) {
  try {
    // Check if user is authenticated
    const user = auth.get().user;
    if (!user || !user.privateKey) {
      throw new Error('Not authenticated');
    }
    
    // Get current following list
    const following = await getFollowing(user.pubkey);
    
    // Check if already following
    if (following.includes(pubkeyToFollow)) {
      return true; // Already following
    }
    
    // Add to following list
    const newFollowing = [...following, pubkeyToFollow];
    
    // Create a new NDK event
    const ndk = await initNDK();
    const event = new NDKEvent(ndk);
    
    // Set the kind (3 = contacts)
    event.kind = NDKKind.Contacts;
    
    // Set empty content
    event.content = '';
    
    // Add p tags for all following
    for (const pubkey of newFollowing) {
      event.tags.push(['p', pubkey]);
    }
    
    // Sign and publish the event
    await event.sign(user.privateKey);
    await event.publish();
    
    toast.success('User followed successfully!');
    return true;
  } catch (error) {
    console.error(`Error following user ${pubkeyToFollow}:`, error);
    toast.error(`Failed to follow user: ${error.message}`);
    throw error;
  }
}

// Unfollow a user
export async function unfollowUser(pubkeyToUnfollow) {
  try {
    // Check if user is authenticated
    const user = auth.get().user;
    if (!user || !user.privateKey) {
      throw new Error('Not authenticated');
    }
    
    // Get current following list
    const following = await getFollowing(user.pubkey);
    
    // Check if not following
    if (!following.includes(pubkeyToUnfollow)) {
      return true; // Already not following
    }
    
    // Remove from following list
    const newFollowing = following.filter(pubkey => pubkey !== pubkeyToUnfollow);
    
    // Create a new NDK event
    const ndk = await initNDK();
    const event = new NDKEvent(ndk);
    
    // Set the kind (3 = contacts)
    event.kind = NDKKind.Contacts;
    
    // Set empty content
    event.content = '';
    
    // Add p tags for all following
    for (const pubkey of newFollowing) {
      event.tags.push(['p', pubkey]);
    }
    
    // Sign and publish the event
    await event.sign(user.privateKey);
    await event.publish();
    
    toast.success('User unfollowed successfully!');
    return true;
  } catch (error) {
    console.error(`Error unfollowing user ${pubkeyToUnfollow}:`, error);
    toast.error(`Failed to unfollow user: ${error.message}`);
    throw error;
  }
}

// Check if a user is following another user
export async function isFollowing(followerPubkey, followedPubkey) {
  try {
    const following = await getFollowing(followerPubkey);
    return following.includes(followedPubkey);
  } catch (error) {
    console.error(`Error checking follow status between ${followerPubkey} and ${followedPubkey}:`, error);
    return false;
  }
}