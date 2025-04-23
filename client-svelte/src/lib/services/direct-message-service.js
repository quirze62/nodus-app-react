import { ndkStore } from './ndk-config.js';
import { db } from '../db/db.js';
import { get } from 'svelte/store';
import { writable } from 'svelte/store';
import { nip04 } from 'nostr-tools';

// Create stores for application state
export const isLoading = writable(false);
export const error = writable(null);
export const messages = writable(new Map());

/**
 * Send a direct message to another user
 * @param {string} receiverPubkey - Receiver's public key
 * @param {string} content - Message content
 * @returns {Promise<Object|null>} - The published Nostr event or null on error
 */
export const sendDirectMessage = async (receiverPubkey, content) => {
  console.info(`[INFO] Sending DM to: ${receiverPubkey.substring(0, 12)}...`);
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
    
    // Encrypt the message content
    const encryptedContent = await nip04.encrypt(
      user.privKey, // Private key for encryption
      receiverPubkey, // Recipient's public key
      content // Message content
    );
    
    // Create tags for the DM
    const tags = [['p', receiverPubkey]];
    
    // Create the event (kind 4 = encrypted direct message)
    const event = {
      kind: 4,
      content: encryptedContent,
      tags
    };
    
    // Publish the event
    const publishedEvent = await ndk.publish(event);
    
    // Cache the event with a plaintext copy for our UI
    const eventWithPlaintext = { 
      ...publishedEvent,
      plaintext: content, // Store plaintext for our UI
      decrypted: true // Mark as already decrypted
    };
    await db.storeEvent(eventWithPlaintext);
    
    // Update our messages store
    const chatId = getChatId(pubkey, receiverPubkey);
    messages.update(msgs => {
      const chat = msgs.get(chatId) || [];
      return msgs.set(chatId, [...chat, eventWithPlaintext]);
    });
    
    isLoading.set(false);
    return publishedEvent;
  } catch (err) {
    console.error('Failed to send direct message:', err);
    error.set(err.message || 'Failed to send message');
    isLoading.set(false);
    return null;
  }
};

/**
 * Get messages between current user and another user
 * @param {string} otherPubkey - The other user's public key
 * @returns {Promise<Array>} - Array of message events
 */
export const getDirectMessages = async (otherPubkey) => {
  console.info(`[INFO] Getting messages with: ${otherPubkey.substring(0, 12)}...`);
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
    const chatId = getChatId(pubkey, otherPubkey);
    
    // Try to get from cache first
    const cachedMessages = await db.getMessagesByChat(chatId);
    if (cachedMessages && cachedMessages.length > 0) {
      // Update the store
      messages.update(msgs => msgs.set(chatId, cachedMessages));
      isLoading.set(false);
      return cachedMessages;
    }
    
    // Fetch messages sent by us
    const sentFilter = {
      kinds: [4],
      authors: [pubkey],
      '#p': [otherPubkey]
    };
    
    // Fetch messages received from the other user
    const receivedFilter = {
      kinds: [4],
      authors: [otherPubkey],
      '#p': [pubkey]
    };
    
    // Use NDK to fetch both sets of events
    const [sentEvents, receivedEvents] = await Promise.all([
      ndk.fetchEvents(sentFilter),
      ndk.fetchEvents(receivedFilter)
    ]);
    
    // Combine and sort the events
    const allEvents = [
      ...Array.from(sentEvents),
      ...Array.from(receivedEvents)
    ];
    
    // Sort by created_at timestamp
    allEvents.sort((a, b) => a.created_at - b.created_at);
    
    // Decrypt the message content
    const decryptedEvents = await Promise.all(
      allEvents.map(async (event) => {
        try {
          // Check if we're the sender or receiver
          const isSender = event.pubkey === pubkey;
          const otherKey = isSender ? otherPubkey : event.pubkey;
          
          // Decrypt the content
          const decrypted = await nip04.decrypt(
            user.privKey, // Our private key for decryption
            otherKey, // The other party's public key
            event.content // The encrypted content
          );
          
          // Return a new event with plaintext content
          return { 
            ...event,
            plaintext: decrypted, // Store plaintext for our UI
            decrypted: true // Mark as decrypted
          };
        } catch (err) {
          console.error(`Failed to decrypt message ${event.id}:`, err);
          return {
            ...event,
            plaintext: '🔒 [Unable to decrypt message]',
            decrypted: false
          };
        }
      })
    );
    
    // Store decrypted events in the cache
    for (const event of decryptedEvents) {
      await db.storeEvent(event);
    }
    
    // Update the store
    messages.update(msgs => msgs.set(chatId, decryptedEvents));
    
    isLoading.set(false);
    return decryptedEvents;
  } catch (err) {
    console.error(`Failed to get direct messages with ${otherPubkey}:`, err);
    error.set(err.message || 'Failed to load messages');
    isLoading.set(false);
    return [];
  }
};

/**
 * Subscribe to new direct messages
 * @param {Function} onMessage - Callback for new messages
 * @returns {Function} - Unsubscribe function
 */
export const subscribeToDirectMessages = (onMessage) => {
  console.info('[INFO] Subscribing to direct messages');
  
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
    
    const pubkey = user.publicKey;
    
    // Create filter for DMs (kind 4) where we are the recipient
    const filter = {
      kinds: [4],
      '#p': [pubkey]
    };
    
    // Create the subscription
    const subscription = ndk.subscribe(filter);
    
    // Handle events
    subscription.on('event', async (event) => {
      try {
        // Only process if we're not the sender
        if (event.pubkey !== pubkey) {
          // Decrypt the content
          const decrypted = await nip04.decrypt(
            user.privKey, // Our private key for decryption
            event.pubkey, // The sender's public key
            event.content // The encrypted content
          );
          
          // Add plaintext to the event for our UI
          const decryptedEvent = { 
            ...event,
            plaintext: decrypted, // Store plaintext for our UI
            decrypted: true // Mark as decrypted
          };
          
          // Store in cache
          await db.storeEvent(decryptedEvent);
          
          // Update our messages store
          const chatId = getChatId(pubkey, event.pubkey);
          messages.update(msgs => {
            const chat = msgs.get(chatId) || [];
            return msgs.set(chatId, [...chat, decryptedEvent]);
          });
          
          // Call the callback
          onMessage(decryptedEvent);
        }
      } catch (err) {
        console.error('Failed to process direct message:', err);
      }
    });
    
    // Return unsubscribe function
    return () => {
      console.info('[INFO] Unsubscribing from direct messages');
      subscription.stop();
    };
  } catch (err) {
    console.error('Failed to subscribe to direct messages:', err);
    
    // Return no-op function
    return () => {};
  }
};

/**
 * Get list of users with whom the current user has DM conversations
 * @returns {Promise<Array<string>>} - Array of public keys
 */
export const getConversations = async () => {
  console.info('[INFO] Getting DM conversations');
  
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
    
    // Get from database first
    const conversations = await db.getConversations(pubkey);
    if (conversations && conversations.length > 0) {
      return conversations;
    }
    
    // Fetch all sent DMs
    const sentFilter = {
      kinds: [4],
      authors: [pubkey]
    };
    
    // Fetch all received DMs
    const receivedFilter = {
      kinds: [4],
      '#p': [pubkey]
    };
    
    // Use NDK to fetch both sets of events
    const [sentEvents, receivedEvents] = await Promise.all([
      ndk.fetchEvents(sentFilter),
      ndk.fetchEvents(receivedFilter)
    ]);
    
    // Extract unique pubkeys
    const contactSet = new Set();
    
    // Process sent messages
    for (const event of sentEvents) {
      const pTags = event.tags.filter(tag => tag[0] === 'p');
      for (const tag of pTags) {
        // Don't add our own pubkey
        if (tag[1] !== pubkey) {
          contactSet.add(tag[1]);
        }
      }
    }
    
    // Process received messages
    for (const event of receivedEvents) {
      // Don't add our own pubkey
      if (event.pubkey !== pubkey) {
        contactSet.add(event.pubkey);
      }
    }
    
    const contactList = Array.from(contactSet);
    
    // Store in database
    await db.storeConversations(pubkey, contactList);
    
    return contactList;
  } catch (err) {
    console.error('Failed to get conversations:', err);
    return [];
  }
};

/**
 * Helper function to create a unique chat ID for two pubkeys
 * @param {string} pubkey1 - First public key
 * @param {string} pubkey2 - Second public key
 * @returns {string} - A unique ID for this chat
 */
function getChatId(pubkey1, pubkey2) {
  // Sort the keys alphabetically to ensure the same ID regardless of order
  const keys = [pubkey1, pubkey2].sort();
  return `${keys[0]}_${keys[1]}`;
}