import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { nip19, getPublicKey, getEventHash, signEvent } from 'nostr-tools';
import { db } from '../db/db.js';

// Create a writable store for the user
const createAuthStore = () => {
  // Initial state
  const initialState = {
    user: null,
    isLoading: false,
    error: null
  };

  const { subscribe, set, update } = writable(initialState);

  // Attempt to load user from IndexedDB
  const loadUserFromStorage = async () => {
    try {
      update(state => ({ ...state, isLoading: true, error: null }));
      
      // Try to get user from database
      const user = await db.getCurrentUser();
      
      if (user) {
        update(state => ({ ...state, user, isLoading: false }));
        return true;
      } else {
        update(state => ({ ...state, isLoading: false }));
        return false;
      }
    } catch (err) {
      console.error('Failed to load user from storage:', err);
      update(state => ({ ...state, isLoading: false, error: 'Failed to load user' }));
      return false;
    }
  };

  // Login with private key
  const login = async (privateKeyOrNsec) => {
    try {
      update(state => ({ ...state, isLoading: true, error: null }));
      
      let privateKey;
      let publicKey;
      
      // Handle nsec input
      if (privateKeyOrNsec.startsWith('nsec')) {
        try {
          const { data } = nip19.decode(privateKeyOrNsec);
          privateKey = data;
          publicKey = getPublicKey(privateKey);
        } catch (err) {
          throw new Error('Invalid nsec format');
        }
      } else {
        // Handle hex private key
        try {
          privateKey = privateKeyOrNsec;
          publicKey = getPublicKey(privateKey);
        } catch (err) {
          throw new Error('Invalid private key format');
        }
      }
      
      // Generate nsec if we don't have it already
      const nsec = privateKeyOrNsec.startsWith('nsec') 
        ? privateKeyOrNsec 
        : nip19.nsecEncode(privateKey);
      
      // Generate npub
      const npub = nip19.npubEncode(publicKey);
      
      // Create user object
      const user = {
        privateKey,
        publicKey,
        nsec,
        npub
      };
      
      // Store user in database
      await db.storeCurrentUser(user);
      
      // Update the store
      update(state => ({ ...state, user, isLoading: false }));
      
      return true;
    } catch (err) {
      console.error('Login failed:', err);
      update(state => ({ 
        ...state, 
        isLoading: false, 
        error: err.message || 'Login failed' 
      }));
      return false;
    }
  };

  // Generate new keys
  const generateNewKeys = async () => {
    try {
      update(state => ({ ...state, isLoading: true, error: null }));
      
      // Generate a random private key (32 bytes)
      const privateKey = window.crypto.getRandomValues(new Uint8Array(32));
      const privateKeyHex = Array.from(privateKey)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      // Get the corresponding public key
      const publicKey = getPublicKey(privateKeyHex);
      
      // Create NIP-19 encodings
      const nsec = nip19.nsecEncode(privateKeyHex);
      const npub = nip19.npubEncode(publicKey);
      
      // Create user object
      const user = {
        privateKey: privateKeyHex,
        publicKey,
        nsec,
        npub
      };
      
      // Store user in database
      await db.storeCurrentUser(user);
      
      // Update the store
      update(state => ({ ...state, user, isLoading: false }));
      
      return user;
    } catch (err) {
      console.error('Key generation failed:', err);
      update(state => ({ 
        ...state, 
        isLoading: false, 
        error: err.message || 'Failed to generate keys' 
      }));
      return null;
    }
  };

  // Logout
  const logout = async () => {
    try {
      // Clear user from database
      await db.clearCurrentUser();
      
      // Update the store
      update(state => ({ ...state, user: null }));
      
      return true;
    } catch (err) {
      console.error('Logout failed:', err);
      return false;
    }
  };

  // Initialize the auth store
  const init = async () => {
    if (browser) {
      await loadUserFromStorage();
    }
  };

  // Initialize on module load
  init();

  return {
    subscribe,
    login,
    generateNewKeys,
    logout,
    reset: () => set(initialState)
  };
};

// Create the store
const auth = createAuthStore();

// Exported values
export const user = derived(auth, $auth => $auth.user);
export const isLoading = derived(auth, $auth => $auth.isLoading);
export const error = derived(auth, $auth => $auth.error);
export const isAuthenticated = derived(auth, $auth => !!$auth.user);

// Exported functions
export const { login, generateNewKeys, logout, reset } = auth;