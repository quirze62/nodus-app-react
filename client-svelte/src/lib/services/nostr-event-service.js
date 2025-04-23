import { ndkStore } from './ndk-config.js';
import { db } from '../db/db.js';
import { get } from 'svelte/store';
import { writable } from 'svelte/store';

// Create stores for application state
export const isLoading = writable(false);
export const error = writable(null);
export const notes = writable([]);

/**
 * Load recent notes from the Nostr network
 * @param {number} limit - Maximum number of notes to load
 * @returns {Promise<Array>} - Array of Nostr events
 */
export const loadNotes = async (limit = 50) => {
  console.info(`[INFO] Fetching ${limit} recent notes`);
  isLoading.set(true);
  error.set(null);
  
  try {
    const ndk = get(ndkStore);
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    // Try to get cached events first
    const cachedEvents = await db.getEventsByKind(1, limit);
    if (cachedEvents.length > 0) {
      console.info(`[INFO] Found ${cachedEvents.length} cached notes`);
      notes.set(cachedEvents);
    }
    
    // Get notes with NDK subscription
    console.info(`[INFO] Getting notes with NDK subscription`);
    
    // Create a filter for text notes (kind 1)
    const filter = {
      kinds: [1],
      limit
    };
    
    // Use a promise to handle the subscription
    const fetchedNotes = await new Promise((resolve, reject) => {
      const fetchedEvents = [];
      const timeoutId = setTimeout(() => {
        // Resolve with what we have after 5 seconds
        resolve(fetchedEvents);
      }, 5000);
      
      // Subscribe to events
      const subscription = ndk.subscribe(filter, {
        closeOnEose: true
      });
      
      subscription.on('event', async (event) => {
        console.info(`[INFO] Received note: ${event.content.substring(0, 30)}...`);
        fetchedEvents.push(event);
        
        // Cache the event
        await db.storeEvent(event);
      });
      
      subscription.on('eose', () => {
        clearTimeout(timeoutId);
        resolve(fetchedEvents);
      });
      
      // Handle errors
      subscription.on('error', (err) => {
        console.error('Subscription error:', err);
        reject(err);
      });
    });
    
    // Combine cached and new notes, sorting by created_at
    const allNotes = [...(cachedEvents || []), ...(fetchedNotes || [])];
    const uniqueNotes = Array.from(
      new Map(allNotes.map(note => [note.id, note])).values()
    );
    
    // Sort by created_at (newest first)
    uniqueNotes.sort((a, b) => b.created_at - a.created_at);
    
    // Update the store
    notes.set(uniqueNotes.slice(0, limit));
    
    isLoading.set(false);
    return uniqueNotes.slice(0, limit);
  } catch (err) {
    console.error('Failed to load notes:', err);
    error.set(err.message || 'Failed to load notes');
    isLoading.set(false);
    return [];
  }
};

/**
 * Post a new note to the Nostr network
 * @param {string} content - Note content
 * @param {Array} tags - Note tags (optional)
 * @returns {Promise<Object>} - The published Nostr event
 */
export const postNote = async (content, tags = []) => {
  console.info(`[INFO] Posting note: ${content.substring(0, 30)}...`);
  isLoading.set(true);
  error.set(null);
  
  try {
    const ndk = get(ndkStore);
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    // Create the event
    const event = {
      kind: 1,
      content,
      tags: tags || []
    };
    
    // Publish the event
    const publishedEvent = await ndk.publish(event);
    
    // Cache the event
    await db.storeEvent(publishedEvent);
    
    // Update the notes store
    notes.update(currentNotes => [publishedEvent, ...currentNotes]);
    
    isLoading.set(false);
    return publishedEvent;
  } catch (err) {
    console.error('Failed to post note:', err);
    error.set(err.message || 'Failed to post note');
    isLoading.set(false);
    return null;
  }
};

/**
 * Get notes by a specific user
 * @param {string} pubkey - User's public key
 * @param {number} limit - Maximum number of notes to load
 * @returns {Promise<Array>} - Array of Nostr events
 */
export const getNotesByUser = async (pubkey, limit = 50) => {
  console.info(`[INFO] Fetching notes by user: ${pubkey.substring(0, 10)}...`);
  isLoading.set(true);
  error.set(null);
  
  try {
    const ndk = get(ndkStore);
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    // Try to get cached events first
    const cachedEvents = await db.getEventsByPubkey(pubkey, limit);
    
    // Create a filter for user's text notes (kind 1)
    const filter = {
      kinds: [1],
      authors: [pubkey],
      limit
    };
    
    // Use NDK to fetch events
    const events = await ndk.fetchEvents(filter);
    const fetchedEvents = Array.from(events);
    
    // Cache the fetched events
    for (const event of fetchedEvents) {
      await db.storeEvent(event);
    }
    
    // Combine cached and new notes, sorting by created_at
    const allNotes = [...(cachedEvents || []), ...(fetchedEvents || [])];
    const uniqueNotes = Array.from(
      new Map(allNotes.map(note => [note.id, note])).values()
    );
    
    // Sort by created_at (newest first)
    uniqueNotes.sort((a, b) => b.created_at - a.created_at);
    
    isLoading.set(false);
    return uniqueNotes.slice(0, limit);
  } catch (err) {
    console.error(`Failed to get notes by user ${pubkey}:`, err);
    error.set(err.message || 'Failed to get user notes');
    isLoading.set(false);
    return [];
  }
};

/**
 * Subscribe to real-time note updates
 * @param {Function} onEvent - Callback for new events
 * @param {Function} onEose - Callback for end of stored events (optional)
 * @param {Object} filter - Custom filter (optional)
 * @returns {Function} - Unsubscribe function
 */
export const subscribeToNotes = (onEvent, onEose, filter = { kinds: [1] }) => {
  console.info(`[INFO] Subscribing to notes with filter:`, filter);
  
  try {
    const ndk = get(ndkStore);
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    // Create the subscription
    const subscription = ndk.subscribe(filter);
    
    // Handle events
    subscription.on('event', async (event) => {
      console.info(`[INFO] Received event in subscription: ${event.id.substring(0, 10)}...`);
      
      // Cache the event
      await db.storeEvent(event);
      
      // Call the callback
      onEvent(event);
    });
    
    // Handle EOSE (End of Stored Events)
    if (onEose) {
      subscription.on('eose', () => {
        console.info('[INFO] End of stored events');
        onEose();
      });
    }
    
    // Return unsubscribe function
    return () => {
      console.info('[INFO] Unsubscribing from notes');
      subscription.stop();
    };
  } catch (err) {
    console.error('Failed to subscribe to notes:', err);
    error.set(err.message || 'Failed to subscribe to notes');
    
    // Return no-op function
    return () => {};
  }
};

/**
 * Create a reply to an existing note
 * @param {string} eventId - ID of event to reply to
 * @param {string} eventPubkey - Pubkey of event author
 * @param {string} rootId - ID of root event in thread (optional)
 * @param {string} content - Reply content
 * @param {Array} additionalTags - Additional tags to include (optional)
 * @returns {Promise<Object>} - The published Nostr event
 */
export const replyToNote = async (eventId, eventPubkey, rootId, content, additionalTags = []) => {
  console.info(`[INFO] Replying to note: ${eventId.substring(0, 10)}...`);
  isLoading.set(true);
  error.set(null);
  
  try {
    const ndk = get(ndkStore);
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    // Create tags for the reply
    const tags = [
      ['e', eventId, '', 'reply'],
      ['p', eventPubkey]
    ];
    
    // Add root tag if this is part of a thread
    if (rootId && rootId !== eventId) {
      tags.push(['e', rootId, '', 'root']);
    }
    
    // Add any additional tags
    if (additionalTags && additionalTags.length > 0) {
      tags.push(...additionalTags);
    }
    
    // Create the event
    const event = {
      kind: 1,
      content,
      tags
    };
    
    // Publish the event
    const publishedEvent = await ndk.publish(event);
    
    // Cache the event
    await db.storeEvent(publishedEvent);
    
    isLoading.set(false);
    return publishedEvent;
  } catch (err) {
    console.error('Failed to reply to note:', err);
    error.set(err.message || 'Failed to reply to note');
    isLoading.set(false);
    return null;
  }
};

/**
 * Create a reaction to an existing note
 * @param {string} eventId - ID of event to react to
 * @param {string} content - Reaction content (usually "+" for like)
 * @returns {Promise<Object>} - The published Nostr event
 */
export const createReaction = async (eventId, content = '+') => {
  console.info(`[INFO] Creating reaction to: ${eventId.substring(0, 10)}...`);
  isLoading.set(true);
  error.set(null);
  
  try {
    const ndk = get(ndkStore);
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    // Get the original event to get the pubkey
    const originalEvent = await ndk.fetchEvent({ ids: [eventId] });
    if (!originalEvent) {
      throw new Error('Original event not found');
    }
    
    // Create tags for the reaction
    const tags = [
      ['e', eventId],
      ['p', originalEvent.pubkey]
    ];
    
    // Create the event
    const event = {
      kind: 7,
      content,
      tags
    };
    
    // Publish the event
    const publishedEvent = await ndk.publish(event);
    
    // Cache the event
    await db.storeEvent(publishedEvent);
    
    isLoading.set(false);
    return publishedEvent;
  } catch (err) {
    console.error('Failed to create reaction:', err);
    error.set(err.message || 'Failed to create reaction');
    isLoading.set(false);
    return null;
  }
};

/**
 * Repost an existing note
 * @param {string} eventId - ID of event to repost
 * @param {string} eventPubkey - Pubkey of event author
 * @returns {Promise<Object>} - The published Nostr event
 */
export const repostNote = async (eventId, eventPubkey) => {
  console.info(`[INFO] Reposting note: ${eventId.substring(0, 10)}...`);
  isLoading.set(true);
  error.set(null);
  
  try {
    const ndk = get(ndkStore);
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    // Create tags for the repost
    const tags = [
      ['e', eventId],
      ['p', eventPubkey]
    ];
    
    // Create the event
    const event = {
      kind: 6,
      content: '',
      tags
    };
    
    // Publish the event
    const publishedEvent = await ndk.publish(event);
    
    // Cache the event
    await db.storeEvent(publishedEvent);
    
    isLoading.set(false);
    return publishedEvent;
  } catch (err) {
    console.error('Failed to repost note:', err);
    error.set(err.message || 'Failed to repost note');
    isLoading.set(false);
    return null;
  }
};

/**
 * Get reactions to a note
 * @param {string} eventId - ID of the note
 * @returns {Promise<Array>} - Array of reaction events
 */
export const getReactions = async (eventId) => {
  console.info(`[INFO] Getting reactions to event ${eventId.substring(0, 10)}...`);
  
  try {
    const ndk = get(ndkStore);
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    // Create filter for reactions (kind 7) to this event
    const filter = {
      kinds: [7],
      '#e': [eventId]
    };
    
    // Fetch reaction events
    const events = await ndk.fetchEvents(filter);
    return Array.from(events);
  } catch (err) {
    console.error(`Failed to get reactions for ${eventId}:`, err);
    return [];
  }
};

/**
 * Get reposts of a note
 * @param {string} eventId - ID of the note
 * @returns {Promise<Array>} - Array of repost events
 */
export const getReposts = async (eventId) => {
  console.info(`[INFO] Getting reposts of event ${eventId.substring(0, 10)}...`);
  
  try {
    const ndk = get(ndkStore);
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    // Create filter for reposts (kind 6) of this event
    const filter = {
      kinds: [6],
      '#e': [eventId]
    };
    
    // Fetch repost events
    const events = await ndk.fetchEvents(filter);
    return Array.from(events);
  } catch (err) {
    console.error(`Failed to get reposts for ${eventId}:`, err);
    return [];
  }
};

/**
 * Get replies to a note
 * @param {string} eventId - ID of the note
 * @returns {Promise<Array>} - Array of reply events
 */
export const getReplies = async (eventId) => {
  console.info(`[INFO] Getting replies to event ${eventId.substring(0, 10)}...`);
  
  try {
    const ndk = get(ndkStore);
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    // Create filter for replies (kind 1) to this event
    const filter = {
      kinds: [1],
      '#e': [eventId]
    };
    
    // Fetch reply events
    const events = await ndk.fetchEvents(filter);
    return Array.from(events);
  } catch (err) {
    console.error(`Failed to get replies for ${eventId}:`, err);
    return [];
  }
};