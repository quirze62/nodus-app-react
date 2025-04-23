import { useNDK, useEvents, useSubscription } from '@nostr-dev-kit/ndk-svelte';
import { db } from '../db/db';
import { toast } from '../stores/toast';

/**
 * Nostr event kinds as per NIPs
 */
export const EventKind = {
  METADATA: 0,
  TEXT_NOTE: 1,
  RECOMMENDED_SERVER: 2,
  CONTACTS: 3,
  ENCRYPTED_DIRECT_MESSAGE: 4,
  DELETE: 5,
  REPOST: 6,
  REACTION: 7
};

/**
 * Fetch notes with reliability and local-first approach
 * @param {Object} filter - Nostr filter object
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<Array>} - Array of notes
 */
export async function fetchNotes(filter = {}, timeoutMs = 8000) {
  const { ndk, storeSubscribe } = useNDK();
  
  // Default filter for text notes
  const defaultFilter = {
    kinds: [EventKind.TEXT_NOTE],
    limit: 50
  };
  
  // Merge default with provided filter
  const mergedFilter = { ...defaultFilter, ...filter };
  
  try {
    // First try to get from local database
    const localNotes = await db.getEventsByKind(EventKind.TEXT_NOTE, mergedFilter.limit);
    
    // Start network request
    const networkPromise = new Promise((resolve) => {
      const notes = [];
      const sub = storeSubscribe(mergedFilter, { closeOnEose: true });
      
      sub.on('event', (event) => {
        notes.push(event);
        // Store in database for offline access
        db.storeEvent(event).catch(e => console.warn('Failed to store note:', e));
      });
      
      sub.on('eose', () => {
        resolve(notes);
      });
      
      // Set timeout for unreliable networks
      setTimeout(() => {
        if (notes.length === 0) {
          console.warn('Fetch notes timed out with no results');
        }
        resolve(notes);
      }, timeoutMs);
    });
    
    // Wait for network response
    const networkNotes = await networkPromise;
    
    // Combine local and network notes, deduplicate by ID
    const allNotes = [...localNotes];
    
    // Add network notes that don't exist locally
    for (const note of networkNotes) {
      if (!allNotes.some(n => n.id === note.id)) {
        allNotes.push(note);
      }
    }
    
    // Sort by created_at, newest first
    allNotes.sort((a, b) => b.created_at - a.created_at);
    
    return allNotes;
  } catch (error) {
    console.error('Error fetching notes:', error);
    toast.error('Failed to fetch notes from the network');
    
    // Fall back to local data only
    const localNotes = await db.getEventsByKind(EventKind.TEXT_NOTE, mergedFilter.limit);
    return localNotes;
  }
}

/**
 * Get messages between two users
 * @param {string} otherPubkey - Public key of the other user
 * @returns {Promise<Array>} - Array of messages
 */
export async function getMessages(otherPubkey) {
  const { ndk, signer } = useNDK();
  
  try {
    if (!signer) {
      throw new Error('Not signed in');
    }
    
    const user = await signer.user();
    
    // Filter for direct messages between the users
    const filter = {
      kinds: [EventKind.ENCRYPTED_DIRECT_MESSAGE],
      authors: [user.pubkey, otherPubkey],
      '#p': [user.pubkey, otherPubkey]
    };
    
    // Use NDK to get messages
    const events = await ndk.fetchEvents(filter);
    
    // Process events with NDK's decryption
    const messages = [];
    for (const event of events) {
      try {
        // If the message is from the other user, decrypt it
        if (event.pubkey !== user.pubkey) {
          await event.decrypt();
        }
        
        messages.push(event);
        
        // Store in database
        db.storeEvent(event).catch(e => console.warn('Failed to store message:', e));
      } catch (e) {
        console.warn('Failed to process message:', e);
      }
    }
    
    // Sort by created_at, oldest first (for chat UI)
    messages.sort((a, b) => a.created_at - b.created_at);
    
    return messages;
  } catch (error) {
    console.error('Error getting messages:', error);
    toast.error('Failed to fetch messages');
    return [];
  }
}

/**
 * Send a direct message to another user
 * @param {string} receiverPubkey - Public key of the receiver
 * @param {string} content - Message content
 * @returns {Promise<Object|null>} - The created message event or null
 */
export async function sendMessage(receiverPubkey, content) {
  const { ndk, signer } = useNDK();
  
  try {
    if (!signer) {
      throw new Error('Not signed in');
    }
    
    // Create and encrypt the message
    const event = await ndk.createEvent({
      kind: EventKind.ENCRYPTED_DIRECT_MESSAGE,
      content,
      tags: [['p', receiverPubkey]]
    });
    
    // Publish the message
    await event.publish();
    
    // Store in database
    await db.storeEvent(event);
    
    return event;
  } catch (error) {
    console.error('Error sending message:', error);
    toast.error('Failed to send message');
    return null;
  }
}

/**
 * Create and publish a new note
 * @param {string} content - Note content
 * @param {Array} tags - Optional tags array
 * @returns {Promise<Object|null>} - The created note event or null
 */
export async function publishNote(content, tags = []) {
  const { ndk, signer } = useNDK();
  
  try {
    if (!signer) {
      throw new Error('Not signed in');
    }
    
    // Create the note
    const event = await ndk.createEvent({
      kind: EventKind.TEXT_NOTE,
      content,
      tags
    });
    
    // Publish the note
    await event.publish();
    
    // Store in database
    await db.storeEvent(event);
    
    toast.success('Note published successfully');
    return event;
  } catch (error) {
    console.error('Error publishing note:', error);
    toast.error('Failed to publish note');
    return null;
  }
}

/**
 * Create a reaction to an event (like, etc.)
 * @param {string} eventId - ID of the event to react to
 * @param {string} content - Reaction content (default: "+")
 * @returns {Promise<Object|null>} - The created reaction event or null
 */
export async function createReaction(eventId, content = '+') {
  const { ndk, signer } = useNDK();
  
  try {
    if (!signer) {
      throw new Error('Not signed in');
    }
    
    // Find the original event to get its author
    const targetEvent = await ndk.fetchEvent({ ids: [eventId] });
    if (!targetEvent) {
      throw new Error('Original event not found');
    }
    
    // Create reaction tags
    const tags = [
      ['e', eventId, '', 'root'],
      ['p', targetEvent.pubkey]
    ];
    
    // Create and publish the reaction
    const event = await ndk.createEvent({
      kind: EventKind.REACTION,
      content,
      tags
    });
    
    await event.publish();
    
    // Store in database
    await db.storeEvent(event);
    
    return event;
  } catch (error) {
    console.error('Error creating reaction:', error);
    toast.error('Failed to create reaction');
    return null;
  }
}

/**
 * Create a repost of an event
 * @param {string} eventId - ID of the event to repost
 * @returns {Promise<Object|null>} - The created repost event or null
 */
export async function createRepost(eventId) {
  const { ndk, signer } = useNDK();
  
  try {
    if (!signer) {
      throw new Error('Not signed in');
    }
    
    // Find the original event
    const targetEvent = await ndk.fetchEvent({ ids: [eventId] });
    if (!targetEvent) {
      throw new Error('Original event not found');
    }
    
    // Create repost tags
    const tags = [
      ['e', eventId, '', 'mention'],
      ['p', targetEvent.pubkey]
    ];
    
    // Create content reference (NIP-18)
    const content = `nostr:${eventId}`;
    
    // Create and publish the repost
    const event = await ndk.createEvent({
      kind: EventKind.REPOST,
      content,
      tags
    });
    
    await event.publish();
    
    // Store in database
    await db.storeEvent(event);
    
    toast.success('Reposted successfully');
    return event;
  } catch (error) {
    console.error('Error creating repost:', error);
    toast.error('Failed to repost');
    return null;
  }
}

/**
 * Reply to a note
 * @param {string} eventId - ID of the event to reply to
 * @param {string} rootId - ID of the root event (optional)
 * @param {string} content - Reply content
 * @param {Array} additionalTags - Optional additional tags
 * @returns {Promise<Object|null>} - The created reply event or null
 */
export async function replyToNote(eventId, rootId, content, additionalTags = []) {
  const { ndk, signer } = useNDK();
  
  try {
    if (!signer) {
      throw new Error('Not signed in');
    }
    
    // Find the event being replied to
    const targetEvent = await ndk.fetchEvent({ ids: [eventId] });
    if (!targetEvent) {
      throw new Error('Original event not found');
    }
    
    // Create reply tags
    const tags = [
      ['e', eventId, '', 'reply'],
      ['p', targetEvent.pubkey]
    ];
    
    // Add root reference if it's different from the parent
    if (rootId && rootId !== eventId) {
      tags.push(['e', rootId, '', 'root']);
    }
    
    // Add any additional tags
    tags.push(...additionalTags);
    
    // Create and publish the reply
    const event = await ndk.createEvent({
      kind: EventKind.TEXT_NOTE,
      content,
      tags
    });
    
    await event.publish();
    
    // Store in database
    await db.storeEvent(event);
    
    toast.success('Reply sent');
    return event;
  } catch (error) {
    console.error('Error replying to note:', error);
    toast.error('Failed to send reply');
    return null;
  }
}