import { writable } from 'svelte/store';
import { NDKNip07Signer } from '@nostr-dev-kit/ndk';
import { db } from '../db/db.js';

// Define NostrUser type for reference
// type NostrUser = {
//   pubkey: string;
//   privkey?: string;
//   displayName?: string;
//   displayNameLowerCase?: string;  
//   name?: string;
//   nip05?: string;
//   about?: string;
//   picture?: string;
//   banner?: string;
//   website?: string;
//   lud16?: string;
// };

// Initialize user store
const createUserStore = () => {
  const { subscribe, set, update } = writable(null);

  return {
    subscribe,
    
    // Login with private key
    loginWithPrivateKey: async (privateKey) => {
      try {
        // Logic to handle private key login with NDK
        // This is a placeholder - implement actual logic
        const user = {
          pubkey: 'test-pubkey', // This would be derived from private key
          privkey: privateKey,
          displayName: 'Test User'
        };
        
        // Save user to IndexedDB
        await db.storeCurrentUser(user);
        
        set(user);
        return true;
      } catch (error) {
        console.error('Login failed:', error);
        return false;
      }
    },
    
    // Login with extension (NIP-07)
    loginWithExtension: async () => {
      try {
        const signer = new NDKNip07Signer();
        await signer.user();
        
        const userPublicKey = await signer.getPublicKey();
        
        const user = {
          pubkey: userPublicKey,
          displayName: 'Extension User'
        };
        
        // Store user info
        await db.storeCurrentUser(user);
        
        set(user);
        return true;
      } catch (error) {
        console.error('Extension login failed:', error);
        return false;
      }
    },
    
    // Generate new keys for user
    generateNewKeys: async () => {
      try {
        // Generate keypair logic
        // This is a placeholder - implement actual logic
        const user = {
          pubkey: 'new-pubkey', 
          privkey: 'new-privkey',
          displayName: 'New User'
        };
        
        await db.storeCurrentUser(user);
        
        set(user);
        return user;
      } catch (error) {
        console.error('Key generation failed:', error);
        throw error;
      }
    },
    
    // Log user out
    logout: async () => {
      set(null);
      // Clear local storage, etc.
    },
    
    // Initialize from stored user data on app load
    initialize: async () => {
      try {
        const storedUser = await db.getCurrentUser();
        if (storedUser) {
          set(storedUser);
        }
      } catch (error) {
        console.error('Failed to initialize user:', error);
      }
    }
  };
};

export const user = createUserStore();