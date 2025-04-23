import { writable, derived } from 'svelte/store';
import { getNDK } from './ndk-config.js';
import { db } from '../db/db.js';
import { user } from '../stores/auth.js';

// Create stores
export const profiles = writable(new Map());
export const isLoading = writable(false);
export const error = writable(null);

// Create a derived store for profiles
export const cachedProfiles = derived(profiles, $profiles => $profiles);

// Default user profile template
const DEFAULT_PROFILE = {
  name: 'Unknown User',
  displayName: '',
  about: '',
  picture: '',
  banner: '',
  nip05: '',
  lud16: '',
  website: ''
};

// Function to get a profile from Nostr
export async function getProfile(pubkey) {
  if (!pubkey) {
    throw new Error('Public key is required');
  }
  
  try {
    isLoading.set(true);
    error.set(null);
    
    // First check if we have this profile in cache
    profiles.update(map => {
      if (!map.has(pubkey)) {
        map.set(pubkey, DEFAULT_PROFILE);
      }
      return map;
    });
    
    // Try to get from IndexedDB
    const cachedProfile = await db.getProfile(pubkey);
    
    if (cachedProfile) {
      profiles.update(map => {
        map.set(pubkey, { ...cachedProfile });
        return map;
      });
    }
    
    // Always try to get the latest profile from the network
    const ndk = getNDK();
    
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    // Create a filter for profile events
    const filter = {
      kinds: [0],
      authors: [pubkey]
    };
    
    // Subscribe to profile updates
    const sub = ndk.subscribe(filter);
    
    // Process profile events as they arrive
    sub.on('event', event => {
      try {
        const content = JSON.parse(event.content);
        
        // Update the profile in the store
        profiles.update(map => {
          map.set(pubkey, {
            pubkey,
            ...DEFAULT_PROFILE,
            ...content,
            updated_at: event.created_at
          });
          return map;
        });
        
        // Store the profile in IndexedDB
        db.storeProfile(pubkey, {
          ...DEFAULT_PROFILE,
          ...content,
          updated_at: event.created_at
        });
      } catch (err) {
        console.error('[ERROR] Failed to process profile event:', err);
      }
    });
    
    // Wait a bit for events to come in
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Unsubscribe
    sub.stop();
    
    // Get current value from store
    let currentProfile;
    profiles.subscribe(map => {
      currentProfile = map.get(pubkey);
    })();
    
    return currentProfile;
  } catch (err) {
    console.error('[ERROR] Failed to get profile:', err);
    error.set(err.message || 'Failed to get profile');
    throw err;
  } finally {
    isLoading.set(false);
  }
}

// Function to update a profile
export async function updateProfile(profile) {
  try {
    isLoading.set(true);
    error.set(null);
    
    const ndk = getNDK();
    
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    // Get current user
    let currentUser;
    user.subscribe(value => {
      currentUser = value;
    })();
    
    if (!currentUser) {
      throw new Error('User not logged in');
    }
    
    // Create a profile event
    const event = {
      kind: 0,
      created_at: Math.floor(Date.now() / 1000),
      content: JSON.stringify(profile),
      tags: []
    };
    
    // Publish the event
    await ndk.publish(event);
    
    // Update local cache
    const pubkey = currentUser.publicKey;
    
    profiles.update(map => {
      map.set(pubkey, {
        pubkey,
        ...profile,
        updated_at: event.created_at
      });
      return map;
    });
    
    // Store the profile in IndexedDB
    await db.storeProfile(pubkey, {
      ...profile,
      updated_at: event.created_at
    });
    
    return true;
  } catch (err) {
    console.error('[ERROR] Failed to update profile:', err);
    error.set(err.message || 'Failed to update profile');
    return false;
  } finally {
    isLoading.set(false);
  }
}

// Function to get the current user's profile
export async function getCurrentUserProfile() {
  try {
    // Get current user
    let currentUser;
    user.subscribe(value => {
      currentUser = value;
    })();
    
    if (!currentUser) {
      throw new Error('User not logged in');
    }
    
    // Get the user's profile
    return await getProfile(currentUser.publicKey);
  } catch (err) {
    console.error('[ERROR] Failed to get current user profile:', err);
    error.set(err.message || 'Failed to get current user profile');
    throw err;
  }
}