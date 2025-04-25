import { useState, useEffect } from 'react';
import { useNDK } from '@nostr-dev-kit/ndk-hooks';
import { NDKEvent, NDKFilter } from '@nostr-dev-kit/ndk';
import logger from '../lib/logger';
import { NostrEvent } from '../lib/nostr';
import { db } from '../lib/db';
import { useNodusUser } from './useNodusUser';

// Direct messages are kind 4
const DM_KIND = 4;

export function useNodusMessages(otherPubkey: string | undefined) {
  const { ndk } = useNDK();
  const { user } = useNodusUser();
  const [messages, setMessages] = useState<NostrEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch messages whenever the other pubkey or ndk changes
  useEffect(() => {
    if (!ndk || !ndk.signer || !user || !otherPubkey) {
      setIsLoading(false);
      return;
    }
    
    const fetchMessages = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Create filter for DMs between these two users
        const filter: NDKFilter = {
          kinds: [DM_KIND],
          authors: [user.publicKey, otherPubkey],
          "#p": [user.publicKey, otherPubkey]
        };
        
        logger.info(`Fetching messages between ${user.publicKey} and ${otherPubkey}`);
        
        // Fetch events
        const events = await ndk.fetchEvents(filter);
        
        // Process and convert events
        const processedMessages: NostrEvent[] = [];
        
        await Promise.all(Array.from(events).map(async (event) => {
          try {
            // If the message is from the other user, decrypt it
            if (event.pubkey !== user.publicKey) {
              await event.decrypt();
            }
            
            // Convert to NostrEvent
            const message: NostrEvent = {
              id: event.id,
              pubkey: event.pubkey,
              created_at: event.created_at,
              kind: event.kind,
              tags: event.tags,
              content: event.content,
              sig: event.sig || ""
            };
            
            // Store in database
            await db.storeEvent(message);
            
            processedMessages.push(message);
          } catch (e) {
            logger.error('Error processing message', e);
          }
        }));
        
        // Sort by time, oldest first for messages
        processedMessages.sort((a, b) => a.created_at - b.created_at);
        
        setMessages(processedMessages);
      } catch (err) {
        logger.error('Error fetching messages', err);
        setError('Failed to fetch messages');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMessages();
  }, [ndk, user, otherPubkey]);
  
  // Send a message
  const sendMessage = async (content: string): Promise<NostrEvent | null> => {
    if (!ndk || !ndk.signer || !user || !otherPubkey) {
      setError('Not signed in or recipient not specified');
      return null;
    }
    
    try {
      logger.info(`Sending message to ${otherPubkey}`);
      
      // Create event
      const event = new NDKEvent(ndk);
      event.kind = DM_KIND;
      event.content = content;
      event.tags = [["p", otherPubkey]];
      
      // This will encrypt, sign, and publish
      await event.publish();
      
      // Convert to NostrEvent
      const message: NostrEvent = {
        id: event.id,
        pubkey: user.publicKey,
        created_at: event.created_at,
        kind: event.kind,
        tags: event.tags,
        content: content, // Store unencrypted content for our own messages
        sig: event.sig || ""
      };
      
      // Store in database
      await db.storeEvent(message);
      
      // Update state
      setMessages(prev => [...prev, message]);
      
      return message;
    } catch (err) {
      logger.error('Error sending message', err);
      setError('Failed to send message');
      return null;
    }
  };
  
  return {
    messages,
    isLoading,
    error,
    sendMessage
  };
}