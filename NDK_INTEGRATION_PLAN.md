# Nodus App - NDK Integration Plan

## Overview
This document outlines the plan to integrate the Nostr Development Kit (NDK) into the Nodus application to enable full Nostr protocol support with proper relays and event handling.

## Timeline
1. **Current Phase (Phase 1)**: PostgreSQL Database Implementation ✓
   - Set up database schema
   - Configure Drizzle ORM
   - Transition from memory storage to database storage

2. **Phase 2: NDK Core Integration** (Next)
   - Install NDK package dependencies
   - Create NDK service wrapper
   - Implement key management system
   - Configure relay connections

3. **Phase 3: Event Handling**
   - Implement event subscription system
   - Enable real-time event updates
   - Add event caching and offline capabilities
   - Migrate existing Nostr functions to use NDK

4. **Phase 4: Advanced Features**
   - NIP integration (NIP-05, NIP-19, etc.)
   - Zap functionality for payments
   - Multi-relay strategies
   - Group messaging

## Technical Details

### Phase 2: NDK Core Integration

1. **Dependencies**
   - Add NDK packages:
   ```bash
   npm install @nostr-dev-kit/ndk
   ```

2. **Core Integration**
   ```typescript
   // client/src/lib/ndk.ts
   import NDK from '@nostr-dev-kit/ndk';
   import { NDKEvent, NDKRelaySet, NDKUser } from '@nostr-dev-kit/ndk';

   // Default relays
   const DEFAULT_RELAYS = [
     'wss://relay.damus.io',
     'wss://relay.nostr.band',
     'wss://nos.lol',
     'wss://relay.current.fyi'
   ];

   // NDK singleton
   let ndkInstance: NDK | null = null;

   export const getNDK = async (): Promise<NDK> => {
     if (!ndkInstance) {
       ndkInstance = new NDK({
         explicitRelayUrls: DEFAULT_RELAYS,
         enableOutboxModel: true, // for offline functionality
       });
       
       await ndkInstance.connect();
     }
     
     return ndkInstance;
   };
   ```

3. **Authentication Integration**
   ```typescript
   // Key management with NDK
   export const loginWithKeys = async (privateKey: string): Promise<NDKUser> => {
     const ndk = await getNDK();
     const user = ndk.signer.user(privateKey);
     return user;
   };
   
   export const generateNewKeys = async (): Promise<NDKUser> => {
     const ndk = await getNDK();
     // Generate fresh keypair
     const newUser = NDKUser.generate();
     return newUser;
   };
   ```

### Phase 3: Event Handling

1. **Post Creation**
   ```typescript
   export const createPost = async (content: string, tags: string[][]): Promise<NDKEvent> => {
     const ndk = await getNDK();
     
     // Create event
     const event = new NDKEvent(ndk);
     event.kind = 1; // Regular post
     event.content = content;
     event.tags = tags;
     
     // Sign and publish
     await event.publish();
     return event;
   };
   ```

2. **Subscription System**
   ```typescript
   export const subscribeToNotes = (
     onEvent: (event: NDKEvent) => void, 
     onEose?: () => void
   ): (() => void) => {
     const ndk = getNDK();
     
     // Create filter
     const filter = { kinds: [1], limit: 100 };
     
     // Subscribe
     const subscription = ndk.subscribe(filter, {
       onEvent,
       onEose
     });
     
     // Return unsubscribe function
     return () => subscription.stop();
   };
   ```

3. **Offline Capability**
   ```typescript
   // Handle offline/online state transitions
   window.addEventListener('online', async () => {
     const ndk = await getNDK();
     await ndk.connect();
     // Sync cached events
     await ndk.outbox.flush();
   });
   
   window.addEventListener('offline', () => {
     // Switch to using local cache only
     // NDK will queue events for later publishing
   });
   ```

### Phase 4: Advanced Features

1. **NIP-05 Verification**
   ```typescript
   export const verifyNIP05 = async (address: string, pubkey: string): Promise<boolean> => {
     try {
       const [name, domain] = address.split('@');
       const url = `https://${domain}/.well-known/nostr.json?name=${name}`;
       const response = await fetch(url);
       const data = await response.json();
       
       return data?.names?.[name] === pubkey;
     } catch (error) {
       console.error('NIP-05 verification failed:', error);
       return false;
     }
   };
   ```

2. **Zap Integration**
   ```typescript
   export const sendZap = async (recipient: NDKUser, amount: number, content?: string): Promise<boolean> => {
     const ndk = await getNDK();
     const zapper = ndk.signer.user();
     
     if (!zapper) {
       throw new Error('Not signed in');
     }
     
     try {
       await zapper.zap(recipient, amount, content);
       return true;
     } catch (error) {
       console.error('Zap failed:', error);
       return false;
     }
   };
   ```

## Benefits of NDK Integration

1. **Simplified API**: NDK provides a more intuitive API for interacting with the Nostr protocol
2. **Better Relay Management**: Automatic handling of relay connections and message routing
3. **Enhanced Offline Support**: Built-in capabilities for offline operation and later synchronization 
4. **Standardized Implementation**: Follows best practices established by the Nostr community
5. **Future-Proof**: Easier to integrate new NIPs as they're adopted

## Considerations

- **Data Migration**: Plan for migrating existing data to the new NDK-based system
- **Performance Testing**: Benchmark relay performance to choose optimal default relays
- **Security Review**: Ensure private key handling is secure throughout the application
- **Progressive Enhancement**: Implement features progressively to maintain stability