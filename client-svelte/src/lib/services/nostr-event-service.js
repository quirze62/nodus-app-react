import { getNDK, initNDK } from './ndk-config';
import { NDKEvent, NDKKind } from '@nostr-dev-kit/ndk';
import { auth } from '../stores/auth';
import { db } from '../db/db';
import { toast } from '../stores/toast';

// Default limit for fetched events
const DEFAULT_LIMIT = 50;

// Log function
function log(message, level = 'info') {
  const logPrefix = `[${level.toUpperCase()}]`;
  console[level](`${logPrefix} ${message}`);
}

// Fetch recent notes
export async function loadNotes(limit = DEFAULT_LIMIT) {
  try {
    log(`Fetching ${limit} recent notes`);
    
    // Try to get from local DB first
    const cachedNotes = await db.getEventsByKind(NDKKind.Text, limit);
    
    // Check if we need to fetch from network
    if (cachedNotes.length >= limit) {
      return cachedNotes;
    }
    
    // Fetch from network
    const ndk = await initNDK();
    
    log('Getting notes with NDK subscription');
    
    // Create a filter for text notes (kind 1)
    const filter = { kinds: [NDKKind.Text], limit };
    
    // Create a subscription
    let notes = [];
    const subscription = ndk.subscribe(filter, { closeOnEose: true });
    
    // Add a timeout for the subscription
    const timeoutPromise = new Promise(resolve => {
      setTimeout(() => {
        log('NDK subscription timeout. Using existing notes if any.');
        resolve();
      }, 5000); // 5 second timeout
    });
    
    // Listen for events
    subscription.on('event', event => {
      notes.push(event.rawEvent());
      db.storeEvent(event.rawEvent()).catch(err => 
        console.error('Error storing event:', err)
      );
    });
    
    // Wait for subscription to end or timeout
    await Promise.race([
      new Promise(resolve => subscription.on('eose', resolve)),
      timeoutPromise
    ]);
    
    // If we didn't get any notes from the subscription, try direct fetch
    if (notes.length === 0 && cachedNotes.length === 0) {
      log('No notes received, trying direct fetch');
      
      // Fetch directly using NDK fetchEvents
      const events = await ndk.fetchEvents(filter);
      
      // Convert to raw events and store
      for (const event of events) {
        const rawEvent = event.rawEvent();
        notes.push(rawEvent);
        await db.storeEvent(rawEvent);
      }
    }
    
    // Combine with cached notes (avoiding duplicates)
    if (cachedNotes.length > 0) {
      // Create a set of existing IDs for deduplication
      const existingIds = new Set(notes.map(note => note.id));
      
      // Add cached notes that aren't already in the array
      for (const cachedNote of cachedNotes) {
        if (!existingIds.has(cachedNote.id)) {
          notes.push(cachedNote);
          existingIds.add(cachedNote.id);
        }
      }
    }
    
    // Sort by created_at (newest first)
    notes.sort((a, b) => b.created_at - a.created_at);
    
    // Limit to the requested number
    return notes.slice(0, limit);
  } catch (error) {
    console.error('Error loading notes:', error);
    
    // Return cached notes if available
    return await db.getEventsByKind(NDKKind.Text, limit);
  }
}

// Post a note
export async function postNote(content, tags = []) {
  try {
    // Check if user is authenticated
    const user = auth.get().user;
    if (!user || !user.privateKey) {
      throw new Error('Not authenticated');
    }
    
    // Create a new NDK event
    const ndk = await initNDK();
    const event = new NDKEvent(ndk);
    
    // Set the content and kind
    event.kind = NDKKind.Text;
    event.content = content;
    
    // Add tags
    if (tags && tags.length > 0) {
      for (const tag of tags) {
        event.tags.push(tag);
      }
    }
    
    // Sign the event with the user's key
    const signedEvent = await event.sign(user.privateKey);
    
    // Publish the event
    await event.publish();
    
    // Store in local DB
    const rawEvent = event.rawEvent();
    await db.storeEvent(rawEvent);
    
    return rawEvent;
  } catch (error) {
    console.error('Error posting note:', error);
    toast.error(`Failed to post note: ${error.message}`);
    throw error;
  }
}

// Send a direct message
export async function sendMessage(receiverPubkey, content) {
  try {
    // Check if user is authenticated
    const user = auth.get().user;
    if (!user || !user.privateKey) {
      throw new Error('Not authenticated');
    }
    
    // Create a new NDK event
    const ndk = await initNDK();
    const event = new NDKEvent(ndk);
    
    // Set the content and kind (4 = encrypted direct message)
    event.kind = NDKKind.EncryptedDirectMessage;
    
    // Add the p tag for the receiver
    event.tags.push(['p', receiverPubkey]);
    
    // Encrypt the content
    event.content = await ndk.encrypt(user.privateKey, receiverPubkey, content);
    
    // Sign and publish the event
    await event.sign(user.privateKey);
    await event.publish();
    
    // Store in local DB
    const rawEvent = event.rawEvent();
    await db.storeEvent(rawEvent);
    
    return rawEvent;
  } catch (error) {
    console.error('Error sending message:', error);
    toast.error(`Failed to send message: ${error.message}`);
    throw error;
  }
}

// Get messages with a specific user
export async function getMessages(pubkey) {
  try {
    // Check if user is authenticated
    const user = auth.get().user;
    if (!user || !user.privateKey) {
      throw new Error('Not authenticated');
    }
    
    // Get messages from local DB
    const sentMessages = await db.getEventsByPubkeyAndKind(user.pubkey, NDKKind.EncryptedDirectMessage);
    const receivedMessages = await db.getEventsByPubkeyAndKind(pubkey, NDKKind.EncryptedDirectMessage);
    
    // Filter messages
    const messages = [];
    
    // Process sent messages
    for (const message of sentMessages) {
      // Check if this message was sent to the specified pubkey
      const toTag = message.tags.find(tag => tag[0] === 'p' && tag[1] === pubkey);
      
      if (toTag) {
        // Try to decrypt
        try {
          // Decrypt the content
          const ndk = await initNDK();
          const decrypted = await ndk.decrypt(user.privateKey, pubkey, message.content);
          
          messages.push({
            ...message,
            content: decrypted
          });
        } catch (err) {
          console.error('Failed to decrypt sent message:', err);
          messages.push(message); // Include encrypted message
        }
      }
    }
    
    // Process received messages
    for (const message of receivedMessages) {
      // Check if this message was sent to the current user
      const toTag = message.tags.find(tag => tag[0] === 'p' && tag[1] === user.pubkey);
      
      if (toTag) {
        // Try to decrypt
        try {
          // Decrypt the content
          const ndk = await initNDK();
          const decrypted = await ndk.decrypt(user.privateKey, message.pubkey, message.content);
          
          messages.push({
            ...message,
            content: decrypted
          });
        } catch (err) {
          console.error('Failed to decrypt received message:', err);
          messages.push(message); // Include encrypted message
        }
      }
    }
    
    // Sort by timestamp
    messages.sort((a, b) => a.created_at - b.created_at);
    
    return messages;
  } catch (error) {
    console.error('Error getting messages:', error);
    toast.error(`Failed to get messages: ${error.message}`);
    throw error;
  }
}

// Create a reaction to an event
export async function createReaction(eventId, content = '+') {
  try {
    // Check if user is authenticated
    const user = auth.get().user;
    if (!user || !user.privateKey) {
      throw new Error('Not authenticated');
    }
    
    // Get the original event
    const originalEvent = await db.getEvent(eventId);
    
    if (!originalEvent) {
      throw new Error('Original event not found');
    }
    
    // Create a new NDK event
    const ndk = await initNDK();
    const event = new NDKEvent(ndk);
    
    // Set the content and kind (7 = reaction)
    event.kind = NDKKind.Reaction;
    event.content = content;
    
    // Add the e tag for the event being reacted to
    event.tags.push(['e', eventId]);
    
    // Add the p tag for the author of the original event
    event.tags.push(['p', originalEvent.pubkey]);
    
    // Sign and publish the event
    await event.sign(user.privateKey);
    await event.publish();
    
    // Store in local DB
    const rawEvent = event.rawEvent();
    await db.storeEvent(rawEvent);
    
    return rawEvent;
  } catch (error) {
    console.error('Error creating reaction:', error);
    toast.error(`Failed to create reaction: ${error.message}`);
    throw error;
  }
}

// Repost an event
export async function repostNote(eventId, eventPubkey) {
  try {
    // Check if user is authenticated
    const user = auth.get().user;
    if (!user || !user.privateKey) {
      throw new Error('Not authenticated');
    }
    
    // Create a new NDK event
    const ndk = await initNDK();
    const event = new NDKEvent(ndk);
    
    // Set the kind (6 = repost)
    event.kind = NDKKind.Repost;
    event.content = '';
    
    // Add the e tag for the event being reposted
    event.tags.push(['e', eventId]);
    
    // Add the p tag for the author of the original event
    event.tags.push(['p', eventPubkey]);
    
    // Sign and publish the event
    await event.sign(user.privateKey);
    await event.publish();
    
    // Store in local DB
    const rawEvent = event.rawEvent();
    await db.storeEvent(rawEvent);
    
    return rawEvent;
  } catch (error) {
    console.error('Error reposting note:', error);
    toast.error(`Failed to repost: ${error.message}`);
    throw error;
  }
}

// Reply to a note
export async function replyToNote(eventId, eventPubkey, rootId, content, additionalTags = []) {
  try {
    // Check if user is authenticated
    const user = auth.get().user;
    if (!user || !user.privateKey) {
      throw new Error('Not authenticated');
    }
    
    // Create a new NDK event
    const ndk = await initNDK();
    const event = new NDKEvent(ndk);
    
    // Set the content and kind (1 = text note)
    event.kind = NDKKind.Text;
    event.content = content;
    
    // Add the e tag for the event being replied to
    event.tags.push(['e', eventId, '', 'reply']);
    
    // Add the p tag for the author of the original event
    event.tags.push(['p', eventPubkey]);
    
    // Add the root tag if provided
    if (rootId && rootId !== eventId) {
      event.tags.push(['e', rootId, '', 'root']);
    }
    
    // Add additional tags
    if (additionalTags && additionalTags.length > 0) {
      for (const tag of additionalTags) {
        event.tags.push(tag);
      }
    }
    
    // Sign and publish the event
    await event.sign(user.privateKey);
    await event.publish();
    
    // Store in local DB
    const rawEvent = event.rawEvent();
    await db.storeEvent(rawEvent);
    
    return rawEvent;
  } catch (error) {
    console.error('Error replying to note:', error);
    toast.error(`Failed to reply: ${error.message}`);
    throw error;
  }
}

// Get reactions to an event
export async function getReactions(eventId) {
  try {
    log(`Getting reactions to event ${eventId}`);
    
    // Try to get from local DB first
    const cachedReactions = await db.events
      .where('kind')
      .equals(NDKKind.Reaction)
      .filter(event => {
        return event.tags.some(tag => tag[0] === 'e' && tag[1] === eventId);
      })
      .toArray();
    
    // Fetch from network
    const ndk = await initNDK();
    
    // Create a filter for reactions
    const filter = {
      kinds: [NDKKind.Reaction],
      '#e': [eventId]
    };
    
    log(`Fetching events with filter: ${JSON.stringify(filter)}`);
    
    // Fetch directly using NDK fetchEvents
    const events = await ndk.fetchEvents(filter);
    
    // Convert to raw events and store
    const reactions = [];
    for (const event of events) {
      const rawEvent = event.rawEvent();
      reactions.push(rawEvent);
      await db.storeEvent(rawEvent);
    }
    
    // Combine with cached reactions (avoiding duplicates)
    if (cachedReactions.length > 0) {
      // Create a set of existing IDs for deduplication
      const existingIds = new Set(reactions.map(r => r.id));
      
      // Add cached reactions that aren't already in the array
      for (const cachedReaction of cachedReactions) {
        if (!existingIds.has(cachedReaction.id)) {
          reactions.push(cachedReaction);
          existingIds.add(cachedReaction.id);
        }
      }
    }
    
    return reactions;
  } catch (error) {
    console.error(`Error getting reactions for ${eventId}:`, error);
    
    // Return cached reactions if available
    return await db.events
      .where('kind')
      .equals(NDKKind.Reaction)
      .filter(event => {
        return event.tags.some(tag => tag[0] === 'e' && tag[1] === eventId);
      })
      .toArray();
  }
}

// Get reposts of an event
export async function getReposts(eventId) {
  try {
    log(`Getting reposts of event ${eventId}`);
    
    // Try to get from local DB first
    const cachedReposts = await db.events
      .where('kind')
      .equals(NDKKind.Repost)
      .filter(event => {
        return event.tags.some(tag => tag[0] === 'e' && tag[1] === eventId);
      })
      .toArray();
    
    // Fetch from network
    const ndk = await initNDK();
    
    // Create a filter for reposts
    const filter = {
      kinds: [NDKKind.Repost],
      '#e': [eventId]
    };
    
    log(`Fetching events with filter: ${JSON.stringify(filter)}`);
    
    // Fetch directly using NDK fetchEvents
    const events = await ndk.fetchEvents(filter);
    
    // Convert to raw events and store
    const reposts = [];
    for (const event of events) {
      const rawEvent = event.rawEvent();
      reposts.push(rawEvent);
      await db.storeEvent(rawEvent);
    }
    
    // Combine with cached reposts (avoiding duplicates)
    if (cachedReposts.length > 0) {
      // Create a set of existing IDs for deduplication
      const existingIds = new Set(reposts.map(r => r.id));
      
      // Add cached reposts that aren't already in the array
      for (const cachedRepost of cachedReposts) {
        if (!existingIds.has(cachedRepost.id)) {
          reposts.push(cachedRepost);
          existingIds.add(cachedRepost.id);
        }
      }
    }
    
    return reposts;
  } catch (error) {
    console.error(`Error getting reposts for ${eventId}:`, error);
    
    // Return cached reposts if available
    return await db.events
      .where('kind')
      .equals(NDKKind.Repost)
      .filter(event => {
        return event.tags.some(tag => tag[0] === 'e' && tag[1] === eventId);
      })
      .toArray();
  }
}

// Get replies to an event
export async function getReplies(eventId) {
  try {
    log(`Getting replies to event ${eventId}`);
    
    // Try to get from local DB first
    const cachedReplies = await db.events
      .where('kind')
      .equals(NDKKind.Text)
      .filter(event => {
        return event.tags.some(tag => 
          tag[0] === 'e' && 
          tag[1] === eventId && 
          (tag[3] === 'reply' || !tag[3])
        );
      })
      .toArray();
    
    // Fetch from network
    const ndk = await initNDK();
    
    // Create a filter for replies
    const filter = {
      kinds: [NDKKind.Text],
      '#e': [eventId]
    };
    
    log(`Fetching events with filter: ${JSON.stringify(filter)}`);
    
    // Fetch directly using NDK fetchEvents
    const events = await ndk.fetchEvents(filter);
    
    // Convert to raw events and store
    const replies = [];
    for (const event of events) {
      const rawEvent = event.rawEvent();
      
      // Check if it's really a reply
      const isReply = rawEvent.tags.some(tag => 
        tag[0] === 'e' && 
        tag[1] === eventId && 
        (tag[3] === 'reply' || !tag[3])
      );
      
      if (isReply) {
        replies.push(rawEvent);
        await db.storeEvent(rawEvent);
      }
    }
    
    // Combine with cached replies (avoiding duplicates)
    if (cachedReplies.length > 0) {
      // Create a set of existing IDs for deduplication
      const existingIds = new Set(replies.map(r => r.id));
      
      // Add cached replies that aren't already in the array
      for (const cachedReply of cachedReplies) {
        if (!existingIds.has(cachedReply.id)) {
          replies.push(cachedReply);
          existingIds.add(cachedReply.id);
        }
      }
    }
    
    return replies;
  } catch (error) {
    console.error(`Error getting replies for ${eventId}:`, error);
    
    // Return cached replies if available
    return await db.events
      .where('kind')
      .equals(NDKKind.Text)
      .filter(event => {
        return event.tags.some(tag => 
          tag[0] === 'e' && 
          tag[1] === eventId && 
          (tag[3] === 'reply' || !tag[3])
        );
      })
      .toArray();
  }
}

// Subscribe to notes
export function subscribeToNotes(onEvent, onEose, filter = {}) {
  try {
    const _filter = {
      kinds: filter.kinds || [NDKKind.Text],
      ...(filter.authors ? { authors: filter.authors } : {})
    };
    
    // Create NDK instance
    initNDK().then(ndk => {
      // Create a subscription
      const subscription = ndk.subscribe(_filter);
      
      // Listen for events
      subscription.on('event', event => {
        const rawEvent = event.rawEvent();
        onEvent(rawEvent);
        
        // Store in local DB
        db.storeEvent(rawEvent).catch(err => 
          console.error('Error storing event:', err)
        );
      });
      
      // Listen for EOSE
      if (onEose) {
        subscription.on('eose', onEose);
      }
    });
    
    // Return unsubscribe function
    return () => {
      // Cleanup subscription when component unmounts
      initNDK().then(ndk => {
        ndk.unsubscribe(_filter);
      });
    };
  } catch (error) {
    console.error('Error subscribing to notes:', error);
    toast.error(`Failed to subscribe to notes: ${error.message}`);
    
    // Return a no-op cleanup function
    return () => {};
  }
}