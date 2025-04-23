import { useNDK, useProfile } from '@nostr-dev-kit/ndk-svelte';
import { EventKind } from './nostr-event-service';
import { db } from '../db/db';
import { toast } from '../stores/toast';

/**
 * Fetch a user's profile with local-first approach
 * @param {string} pubkey - Public key of the user
 * @returns {Promise<Object|null>} - User profile or null
 */
export async function fetchProfile(pubkey) {
  if (!pubkey) return null;
  
  try {
    // First try to get from local database
    const localProfile = await db.getProfile(pubkey);
    
    // Use NDK's reactive profile
    const { profileContent, fetchProfile } = useProfile(pubkey);
    
    // Start fetching profile from network
    fetchProfile().catch(err => {
      console.warn(`Error fetching profile for ${pubkey}:`, err);
    });
    
    // Return local profile immediately if available
    if (localProfile) {
      return localProfile;
    }
    
    // Wait for network profile (with timeout)
    const timeoutPromise = new Promise(resolve => {
      setTimeout(() => resolve(null), 5000);
    });
    
    // Get profile from network
    const profile = await Promise.race([
      new Promise(resolve => {
        const unsubscribe = profileContent.subscribe(profile => {
          if (profile) {
            unsubscribe();
            resolve(profile);
          }
        });
      }),
      timeoutPromise
    ]);
    
    // If we got a profile from the network, store it
    if (profile) {
      await db.storeProfile(pubkey, profile);
    }
    
    return profile;
  } catch (error) {
    console.error('Error fetching profile:', error);
    toast.error('Failed to fetch user profile');
    return null;
  }
}

/**
 * Update the current user's profile
 * @param {Object} profileData - Profile data to update
 * @returns {Promise<boolean>} - Success status
 */
export async function updateProfile(profileData) {
  const { ndk, signer } = useNDK();
  
  try {
    if (!signer) {
      throw new Error('Not signed in');
    }
    
    const user = await signer.user();
    
    // Create metadata event
    const event = await ndk.createEvent({
      kind: EventKind.METADATA,
      content: JSON.stringify(profileData)
    });
    
    // Publish the profile update
    await event.publish();
    
    // Store in database
    await db.storeProfile(user.pubkey, profileData);
    
    toast.success('Profile updated successfully');
    return true;
  } catch (error) {
    console.error('Error updating profile:', error);
    toast.error('Failed to update profile');
    return false;
  }
}

/**
 * Get a user's followers
 * @param {string} pubkey - Public key of the user
 * @returns {Promise<Array>} - Array of followers
 */
export async function getFollowers(pubkey) {
  const { ndk } = useNDK();
  
  try {
    // Find profiles that have this user in their contact list
    const filter = {
      kinds: [EventKind.CONTACTS],
      '#p': [pubkey]
    };
    
    const events = await ndk.fetchEvents(filter);
    
    // Extract follower pubkeys
    const followers = Array.from(events).map(event => event.pubkey);
    
    return followers;
  } catch (error) {
    console.error('Error getting followers:', error);
    return [];
  }
}

/**
 * Get users that a user is following
 * @param {string} pubkey - Public key of the user
 * @returns {Promise<Array>} - Array of followed users
 */
export async function getFollowing(pubkey) {
  const { ndk } = useNDK();
  
  try {
    // Get the user's contact list
    const filter = {
      kinds: [EventKind.CONTACTS],
      authors: [pubkey]
    };
    
    const events = await ndk.fetchEvents(filter);
    
    // Get the latest contacts event
    const contactsEvent = Array.from(events)
      .sort((a, b) => b.created_at - a.created_at)[0];
    
    if (!contactsEvent) {
      return [];
    }
    
    // Extract followed user pubkeys from p tags
    const following = contactsEvent.tags
      .filter(tag => tag[0] === 'p')
      .map(tag => tag[1]);
    
    return following;
  } catch (error) {
    console.error('Error getting following:', error);
    return [];
  }
}

/**
 * Update the user's contact list (following list)
 * @param {Array} contacts - Array of pubkeys to follow
 * @returns {Promise<boolean>} - Success status
 */
export async function updateContacts(contacts) {
  const { ndk, signer } = useNDK();
  
  try {
    if (!signer) {
      throw new Error('Not signed in');
    }
    
    // Create tags for each contact
    const tags = contacts.map(pubkey => ['p', pubkey]);
    
    // Create contacts event
    const event = await ndk.createEvent({
      kind: EventKind.CONTACTS,
      tags
    });
    
    // Publish the contacts update
    await event.publish();
    
    toast.success('Contact list updated');
    return true;
  } catch (error) {
    console.error('Error updating contacts:', error);
    toast.error('Failed to update contacts');
    return false;
  }
}

/**
 * Follow a user
 * @param {string} pubkey - Public key of the user to follow
 * @returns {Promise<boolean>} - Success status
 */
export async function followUser(pubkey) {
  const { ndk, signer } = useNDK();
  
  try {
    if (!signer) {
      throw new Error('Not signed in');
    }
    
    const user = await signer.user();
    
    // Get current contacts
    const currentContacts = await getFollowing(user.pubkey);
    
    // If already following, do nothing
    if (currentContacts.includes(pubkey)) {
      return true;
    }
    
    // Add to contacts
    const newContacts = [...currentContacts, pubkey];
    
    // Update contacts
    return await updateContacts(newContacts);
  } catch (error) {
    console.error('Error following user:', error);
    toast.error('Failed to follow user');
    return false;
  }
}

/**
 * Unfollow a user
 * @param {string} pubkey - Public key of the user to unfollow
 * @returns {Promise<boolean>} - Success status
 */
export async function unfollowUser(pubkey) {
  const { ndk, signer } = useNDK();
  
  try {
    if (!signer) {
      throw new Error('Not signed in');
    }
    
    const user = await signer.user();
    
    // Get current contacts
    const currentContacts = await getFollowing(user.pubkey);
    
    // If not already following, do nothing
    if (!currentContacts.includes(pubkey)) {
      return true;
    }
    
    // Remove from contacts
    const newContacts = currentContacts.filter(p => p !== pubkey);
    
    // Update contacts
    return await updateContacts(newContacts);
  } catch (error) {
    console.error('Error unfollowing user:', error);
    toast.error('Failed to unfollow user');
    return false;
  }
}