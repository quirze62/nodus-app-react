import { writable, derived } from 'svelte/store';
import { getNDK } from './ndk-config.js';
import { db } from '../db/db.js';
import { user } from '../stores/auth.js';

// Create stores
export const events = writable([]);
export const userEvents = writable([]);
export const isLoading = writable(false);
export const error = writable(null);

// Function to load notes (kind 1 events)
export async function loadNotes(limit = 50) {
  try {
    console.info('[INFO] Fetching', limit, 'recent notes');
    isLoading.set(true);
    error.set(null);
    
    // Try to get from local cache first
    const cachedEvents = await db.getEventsByKind(1, limit);
    
    if (cachedEvents && cachedEvents.length > 0) {
      events.set(cachedEvents);
    }
    
    // Get from network
    const ndk = getNDK();
    
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    console.info('[INFO] Getting notes with NDK subscription');
    
    // Create a filter for notes
    const filter = {
      kinds: [1],
      limit
    };
    
    // Create a subscription
    const sub = ndk.subscribe(filter);
    
    // Collect events
    const newEvents = [];
    
    // Process events as they arrive
    sub.on('event', event => {
      // Store the event
      db.storeEvent(event);
      
      // Add to our local array
      newEvents.push(event);
      
      // Log for debugging
      console.info('[INFO] Received note:', event.content.substring(0, 30) + '...');
    });
    
    // Wait for events to be collected
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Stop the subscription
    sub.stop();
    
    // Sort by created_at (newest first)
    newEvents.sort((a, b) => b.created_at - a.created_at);
    
    // Update the store
    events.set(newEvents);
    
    return newEvents;
  } catch (err) {
    console.error('[ERROR] Failed to load notes:', err);
    error.set(err.message || 'Failed to load notes');
    return [];
  } finally {
    isLoading.set(false);
  }
}

// Function to load notes from a specific user
export async function loadUserNotes(pubkey, limit = 50) {
  if (!pubkey) {
    throw new Error('Public key is required');
  }
  
  try {
    isLoading.set(true);
    error.set(null);
    
    // Try to get from local cache first
    const cachedEvents = await db.getEventsByPubkey(pubkey, limit);
    
    if (cachedEvents && cachedEvents.length > 0) {
      userEvents.set(cachedEvents.filter(event => event.kind === 1));
    }
    
    // Get from network
    const ndk = getNDK();
    
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    // Create a filter for user notes
    const filter = {
      kinds: [1],
      authors: [pubkey],
      limit
    };
    
    // Create a subscription
    const sub = ndk.subscribe(filter);
    
    // Collect events
    const newEvents = [];
    
    // Process events as they arrive
    sub.on('event', event => {
      // Store the event
      db.storeEvent(event);
      
      // Add to our local array
      newEvents.push(event);
    });
    
    // Wait for events to be collected
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Stop the subscription
    sub.stop();
    
    // Sort by created_at (newest first)
    newEvents.sort((a, b) => b.created_at - a.created_at);
    
    // Update the store
    userEvents.set(newEvents);
    
    return newEvents;
  } catch (err) {
    console.error('[ERROR] Failed to load user notes:', err);
    error.set(err.message || 'Failed to load user notes');
    return [];
  } finally {
    isLoading.set(false);
  }
}

// Function to post a note
export async function postNote(content, tags = []) {
  if (!content) {
    throw new Error('Content is required');
  }
  
  try {
    isLoading.set(true);
    error.set(null);
    
    // Get current user
    let currentUser;
    user.subscribe(value => {
      currentUser = value;
    })();
    
    if (!currentUser) {
      throw new Error('User not logged in');
    }
    
    const ndk = getNDK();
    
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    // Create the event
    const event = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      content,
      tags
    };
    
    // Publish the event
    await ndk.publish(event);
    
    // Store the event
    await db.storeEvent(event);
    
    // Update the events store
    events.update(list => {
      // Add to the beginning (newest first)
      list.unshift(event);
      return list;
    });
    
    // Update user events store
    userEvents.update(list => {
      // Add to the beginning (newest first)
      list.unshift(event);
      return list;
    });
    
    return event;
  } catch (err) {
    console.error('[ERROR] Failed to post note:', err);
    error.set(err.message || 'Failed to post note');
    return null;
  } finally {
    isLoading.set(false);
  }
}

// Function to get reactions to an event
export async function getReactions(eventId) {
  if (!eventId) {
    throw new Error('Event ID is required');
  }
  
  try {
    console.info('[INFO] Getting reactions to event', eventId);
    isLoading.set(true);
    error.set(null);
    
    const ndk = getNDK();
    
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    // Create a filter for reactions
    const filter = {
      kinds: [7], // Reaction events
      '#e': [eventId]
    };
    
    // Create a subscription
    const sub = ndk.subscribe(filter);
    
    // Collect reactions
    const reactions = [];
    
    // Process events as they arrive
    sub.on('event', event => {
      // Store the event
      db.storeEvent(event);
      
      // Add to our local array
      reactions.push(event);
    });
    
    // Wait for events to be collected
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Stop the subscription
    sub.stop();
    
    return reactions;
  } catch (err) {
    console.error('[ERROR] Failed to get reactions:', err);
    error.set(err.message || 'Failed to get reactions');
    return [];
  } finally {
    isLoading.set(false);
  }
}

// Function to get reposts of an event
export async function getReposts(eventId) {
  if (!eventId) {
    throw new Error('Event ID is required');
  }
  
  try {
    console.info('[INFO] Getting reposts of event', eventId);
    isLoading.set(true);
    error.set(null);
    
    const ndk = getNDK();
    
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    // Create a filter for reposts
    const filter = {
      kinds: [6], // Repost events
      '#e': [eventId]
    };
    
    // Create a subscription
    const sub = ndk.subscribe(filter);
    
    // Collect reposts
    const reposts = [];
    
    // Process events as they arrive
    sub.on('event', event => {
      // Store the event
      db.storeEvent(event);
      
      // Add to our local array
      reposts.push(event);
    });
    
    // Wait for events to be collected
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Stop the subscription
    sub.stop();
    
    return reposts;
  } catch (err) {
    console.error('[ERROR] Failed to get reposts:', err);
    error.set(err.message || 'Failed to get reposts');
    return [];
  } finally {
    isLoading.set(false);
  }
}

// Function to get replies to an event
export async function getReplies(eventId) {
  if (!eventId) {
    throw new Error('Event ID is required');
  }
  
  try {
    console.info('[INFO] Getting replies to event', eventId);
    isLoading.set(true);
    error.set(null);
    
    const ndk = getNDK();
    
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    // Create a filter for replies
    const filter = {
      kinds: [1], // Note events
      '#e': [eventId]
    };
    
    // Create a subscription
    const sub = ndk.subscribe(filter);
    
    // Collect replies
    const replies = [];
    
    // Process events as they arrive
    sub.on('event', event => {
      // Store the event
      db.storeEvent(event);
      
      // Add to our local array
      replies.push(event);
    });
    
    // Wait for events to be collected
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Stop the subscription
    sub.stop();
    
    return replies;
  } catch (err) {
    console.error('[ERROR] Failed to get replies:', err);
    error.set(err.message || 'Failed to get replies');
    return [];
  } finally {
    isLoading.set(false);
  }
}

// Function to create a reaction to an event
export async function createReaction(eventId, content = '+') {
  if (!eventId) {
    throw new Error('Event ID is required');
  }
  
  try {
    isLoading.set(true);
    error.set(null);
    
    // Get current user
    let currentUser;
    user.subscribe(value => {
      currentUser = value;
    })();
    
    if (!currentUser) {
      throw new Error('User not logged in');
    }
    
    const ndk = getNDK();
    
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    // Create the reaction event
    const event = {
      kind: 7,
      created_at: Math.floor(Date.now() / 1000),
      content,
      tags: [
        ['e', eventId]
      ]
    };
    
    // Publish the event
    await ndk.publish(event);
    
    // Store the event
    await db.storeEvent(event);
    
    return event;
  } catch (err) {
    console.error('[ERROR] Failed to create reaction:', err);
    error.set(err.message || 'Failed to create reaction');
    return null;
  } finally {
    isLoading.set(false);
  }
}

// Function to repost an event
export async function repostNote(eventId, eventPubkey) {
  if (!eventId || !eventPubkey) {
    throw new Error('Event ID and pubkey are required');
  }
  
  try {
    isLoading.set(true);
    error.set(null);
    
    // Get current user
    let currentUser;
    user.subscribe(value => {
      currentUser = value;
    })();
    
    if (!currentUser) {
      throw new Error('User not logged in');
    }
    
    const ndk = getNDK();
    
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    // Create the repost event
    const event = {
      kind: 6,
      created_at: Math.floor(Date.now() / 1000),
      content: '',
      tags: [
        ['e', eventId],
        ['p', eventPubkey]
      ]
    };
    
    // Publish the event
    await ndk.publish(event);
    
    // Store the event
    await db.storeEvent(event);
    
    return event;
  } catch (err) {
    console.error('[ERROR] Failed to repost note:', err);
    error.set(err.message || 'Failed to repost note');
    return null;
  } finally {
    isLoading.set(false);
  }
}

// Function to reply to an event
export async function replyToNote(eventId, eventPubkey, rootId, content, additionalTags = []) {
  if (!eventId || !eventPubkey || !content) {
    throw new Error('Event ID, pubkey, and content are required');
  }
  
  try {
    isLoading.set(true);
    error.set(null);
    
    // Get current user
    let currentUser;
    user.subscribe(value => {
      currentUser = value;
    })();
    
    if (!currentUser) {
      throw new Error('User not logged in');
    }
    
    const ndk = getNDK();
    
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    // Create tags for the reply
    const tags = [
      ['e', eventId, '', 'reply'],
      ['p', eventPubkey]
    ];
    
    // Add root tag if we have a root ID
    if (rootId && rootId !== eventId) {
      tags.push(['e', rootId, '', 'root']);
    }
    
    // Add any additional tags
    if (additionalTags && additionalTags.length > 0) {
      tags.push(...additionalTags);
    }
    
    // Create the reply event
    const event = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      content,
      tags
    };
    
    // Publish the event
    await ndk.publish(event);
    
    // Store the event
    await db.storeEvent(event);
    
    // Update the events store
    events.update(list => {
      // Add to the beginning (newest first)
      list.unshift(event);
      return list;
    });
    
    return event;
  } catch (err) {
    console.error('[ERROR] Failed to reply to note:', err);
    error.set(err.message || 'Failed to reply to note');
    return null;
  } finally {
    isLoading.set(false);
  }
}

// Function to subscribe to notes
export function subscribeToNotes(onEvent, onEose, filter = {}) {
  try {
    const ndk = getNDK();
    
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    // Create a filter for notes
    const noteFilter = {
      kinds: [1],
      ...filter
    };
    
    // Create a subscription
    const sub = ndk.subscribe(noteFilter);
    
    // Process events as they arrive
    sub.on('event', event => {
      // Store the event
      db.storeEvent(event);
      
      // Call the callback
      onEvent(event);
    });
    
    // Handle end of stored events
    if (onEose) {
      sub.on('eose', onEose);
    }
    
    // Return a function to stop the subscription
    return () => sub.stop();
  } catch (err) {
    console.error('[ERROR] Failed to subscribe to notes:', err);
    error.set(err.message || 'Failed to subscribe to notes');
    return () => {};
  }
}