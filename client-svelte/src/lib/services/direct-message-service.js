import { writable, derived } from 'svelte/store';
import { getNDK } from './ndk-config.js';
import { db } from '../db/db.js';
import { user } from '../stores/auth.js';
import { nip04 } from 'nostr-tools';

// Create stores
export const messages = writable(new Map());
export const conversations = writable([]);
export const isLoading = writable(false);
export const error = writable(null);

// Function to get direct messages for a specific contact
export async function getDirectMessages(recipientPubkey) {
  if (!recipientPubkey) {
    throw new Error('Recipient public key is required');
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
    
    const userPubkey = currentUser.publicKey;
    const userPrivkey = currentUser.privateKey;
    
    // Create a unique chat ID for this conversation
    const keys = [userPubkey, recipientPubkey].sort();
    const chatId = `${keys[0]}_${keys[1]}`;
    
    // Initialize the messages array for this conversation
    messages.update(map => {
      if (!map.has(chatId)) {
        map.set(chatId, []);
      }
      return map;
    });
    
    // Subscribe to direct messages sent by user to recipient
    const filter1 = {
      kinds: [4],
      authors: [userPubkey],
      '#p': [recipientPubkey]
    };
    
    // Subscribe to direct messages sent by recipient to user
    const filter2 = {
      kinds: [4],
      authors: [recipientPubkey],
      '#p': [userPubkey]
    };
    
    // Create subscription for messages from user to recipient
    const sub1 = ndk.subscribe(filter1);
    
    // Process events as they arrive
    sub1.on('event', async event => {
      try {
        // Decrypt the message content
        const decrypted = await nip04.decrypt(
          userPrivkey,
          recipientPubkey,
          event.content
        );
        
        // Create a message object
        const message = {
          id: event.id,
          pubkey: event.pubkey,
          created_at: event.created_at,
          content: event.content,
          plaintext: decrypted,
          tags: event.tags,
          sig: event.sig
        };
        
        // Store the event
        await db.storeEvent(event);
        
        // Update the messages store
        messages.update(map => {
          const msgs = map.get(chatId) || [];
          
          // Only add if not already present
          if (!msgs.some(m => m.id === message.id)) {
            msgs.push(message);
            
            // Sort by created_at
            msgs.sort((a, b) => a.created_at - b.created_at);
            
            map.set(chatId, msgs);
          }
          
          return map;
        });
      } catch (err) {
        console.error('[ERROR] Failed to process message from user:', err);
      }
    });
    
    // Create subscription for messages from recipient to user
    const sub2 = ndk.subscribe(filter2);
    
    // Process events as they arrive
    sub2.on('event', async event => {
      try {
        // Decrypt the message content
        const decrypted = await nip04.decrypt(
          userPrivkey,
          recipientPubkey,
          event.content
        );
        
        // Create a message object
        const message = {
          id: event.id,
          pubkey: event.pubkey,
          created_at: event.created_at,
          content: event.content,
          plaintext: decrypted,
          tags: event.tags,
          sig: event.sig
        };
        
        // Store the event
        await db.storeEvent(event);
        
        // Update the messages store
        messages.update(map => {
          const msgs = map.get(chatId) || [];
          
          // Only add if not already present
          if (!msgs.some(m => m.id === message.id)) {
            msgs.push(message);
            
            // Sort by created_at
            msgs.sort((a, b) => a.created_at - b.created_at);
            
            map.set(chatId, msgs);
          }
          
          return map;
        });
      } catch (err) {
        console.error('[ERROR] Failed to process message from recipient:', err);
      }
    });
    
    // Wait for initial messages to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Stop the subscriptions
    sub1.stop();
    sub2.stop();
    
    // Update the conversations list
    updateConversations(recipientPubkey);
    
    return messages;
  } catch (err) {
    console.error('[ERROR] Failed to get direct messages:', err);
    error.set(err.message || 'Failed to get direct messages');
    throw err;
  } finally {
    isLoading.set(false);
  }
}

// Function to send a direct message
export async function sendDirectMessage(recipientPubkey, content) {
  if (!recipientPubkey) {
    throw new Error('Recipient public key is required');
  }
  
  if (!content) {
    throw new Error('Message content is required');
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
    
    const userPubkey = currentUser.publicKey;
    const userPrivkey = currentUser.privateKey;
    
    // Encrypt the message content
    const encrypted = await nip04.encrypt(
      userPrivkey,
      recipientPubkey,
      content
    );
    
    // Create the message event
    const event = {
      kind: 4,
      created_at: Math.floor(Date.now() / 1000),
      content: encrypted,
      tags: [['p', recipientPubkey]]
    };
    
    // Publish the event
    await ndk.publish(event);
    
    // Create a unique chat ID for this conversation
    const keys = [userPubkey, recipientPubkey].sort();
    const chatId = `${keys[0]}_${keys[1]}`;
    
    // Create a message object
    const message = {
      id: event.id,
      pubkey: userPubkey,
      created_at: event.created_at,
      content: encrypted,
      plaintext: content,
      tags: event.tags,
      sig: event.sig
    };
    
    // Update the messages store
    messages.update(map => {
      const msgs = map.get(chatId) || [];
      
      // Add the new message
      msgs.push(message);
      
      // Sort by created_at
      msgs.sort((a, b) => a.created_at - b.created_at);
      
      map.set(chatId, msgs);
      
      return map;
    });
    
    // Store the event
    await db.storeEvent(event);
    
    // Update the conversations list
    updateConversations(recipientPubkey);
    
    return message;
  } catch (err) {
    console.error('[ERROR] Failed to send direct message:', err);
    error.set(err.message || 'Failed to send direct message');
    throw err;
  } finally {
    isLoading.set(false);
  }
}

// Function to get all conversations
export async function getConversations() {
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
    
    const userPubkey = currentUser.publicKey;
    
    // Subscribe to all direct messages sent by user
    const filter1 = {
      kinds: [4],
      authors: [userPubkey]
    };
    
    // Subscribe to all direct messages sent to user
    const filter2 = {
      kinds: [4],
      '#p': [userPubkey]
    };
    
    // Set of conversation partners
    const conversationSet = new Set();
    
    // Create subscription for messages from user
    const sub1 = ndk.subscribe(filter1);
    
    // Process events as they arrive
    sub1.on('event', event => {
      try {
        // Extract the recipient from the p tag
        const pTags = event.tags.filter(tag => tag[0] === 'p');
        
        if (pTags.length > 0) {
          const recipientPubkey = pTags[0][1];
          conversationSet.add(recipientPubkey);
        }
      } catch (err) {
        console.error('[ERROR] Failed to process outgoing message:', err);
      }
    });
    
    // Create subscription for messages to user
    const sub2 = ndk.subscribe(filter2);
    
    // Process events as they arrive
    sub2.on('event', event => {
      try {
        // The sender pubkey
        const senderPubkey = event.pubkey;
        conversationSet.add(senderPubkey);
      } catch (err) {
        console.error('[ERROR] Failed to process incoming message:', err);
      }
    });
    
    // Wait for conversations to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Stop the subscriptions
    sub1.stop();
    sub2.stop();
    
    // Convert the set to an array
    const conversationArray = Array.from(conversationSet);
    
    // Update the conversations store
    conversations.set(conversationArray);
    
    return conversationArray;
  } catch (err) {
    console.error('[ERROR] Failed to get conversations:', err);
    error.set(err.message || 'Failed to get conversations');
    throw err;
  } finally {
    isLoading.set(false);
  }
}

// Helper function to update the conversations list
function updateConversations(pubkey) {
  if (!pubkey) return;
  
  conversations.update(list => {
    if (!list.includes(pubkey)) {
      list.push(pubkey);
    }
    return list;
  });
}