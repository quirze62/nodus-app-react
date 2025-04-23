import { writable, derived } from 'svelte/store';
import { useNDK } from '@nostr-dev-kit/ndk-svelte';
import { db } from '../db/db';

// Initial authentication state
const initialState = {
  isLoading: true,
  isAuthenticated: false,
  user: null,
  error: null
};

// Create the auth store
function createAuthStore() {
  const { subscribe, set, update } = writable(initialState);
  const { ndk } = useNDK();
  
  // Load user from stored session
  async function loadUserFromSession() {
    update(state => ({ ...state, isLoading: true }));
    
    try {
      // Try to load from IndexedDB first
      const session = await db.getSession();
      
      if (session && session.privateKey) {
        return login(session.privateKey);
      } else {
        update(state => ({
          ...state,
          isLoading: false
        }));
      }
    } catch (error) {
      console.error('Error loading user from session:', error);
      update(state => ({
        ...state,
        isLoading: false,
        error: 'Failed to load session'
      }));
    }
  }
  
  // Login with private key
  async function login(privateKey) {
    update(state => ({ ...state, isLoading: true, error: null }));
    
    try {
      // Create a signer with the private key
      await ndk.connect();
      const signer = ndk.signer.getOrCreate({ privateKey });
      
      // Get the user
      const user = await signer.user();
      
      // Fetch and store profile data
      try {
        await user.fetchProfile();
      } catch (e) {
        console.warn('Could not fetch profile:', e);
      }
      
      // Format user data
      const userData = {
        pubkey: user.pubkey,
        npub: user.npub,
        privateKey,
        profile: user.profile || {}
      };
      
      // Store in local DB
      await db.storeSession(userData);
      
      // Update the store
      update(state => ({
        ...state,
        isAuthenticated: true,
        user: userData,
        isLoading: false
      }));
      
      return userData;
    } catch (error) {
      console.error('Login error:', error);
      update(state => ({
        ...state,
        isAuthenticated: false,
        user: null,
        error: 'Login failed',
        isLoading: false
      }));
      throw error;
    }
  }
  
  // Generate a new key pair
  async function generateNewKeys() {
    update(state => ({ ...state, isLoading: true, error: null }));
    
    try {
      // Generate new keys using NDK
      await ndk.connect();
      const privateKey = window.crypto.getRandomValues(new Uint8Array(32))
        .reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
      
      return login(privateKey);
    } catch (error) {
      console.error('Error generating keys:', error);
      update(state => ({
        ...state,
        error: 'Failed to generate keys',
        isLoading: false
      }));
      throw error;
    }
  }
  
  // Logout
  async function logout() {
    try {
      // Clear the session
      await db.clearSession();
      
      // Reset the store
      set({
        isLoading: false,
        isAuthenticated: false,
        user: null,
        error: null
      });
      
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      update(state => ({
        ...state,
        error: 'Logout failed'
      }));
      return false;
    }
  }
  
  // Check if the session is valid
  async function checkSession() {
    update(state => ({ ...state, isLoading: true }));
    
    try {
      const session = await db.getSession();
      
      if (session && session.privateKey) {
        // Validate the private key
        await ndk.connect();
        const signer = ndk.signer.getOrCreate({ privateKey: session.privateKey });
        const user = await signer.user();
        
        if (user && user.pubkey) {
          update(state => ({
            ...state,
            isAuthenticated: true,
            user: session,
            isLoading: false
          }));
          return true;
        }
      }
      
      // No valid session
      update(state => ({
        ...state,
        isAuthenticated: false,
        user: null,
        isLoading: false
      }));
      return false;
    } catch (error) {
      console.error('Error checking session:', error);
      update(state => ({
        ...state,
        isAuthenticated: false,
        user: null,
        error: 'Session validation failed',
        isLoading: false
      }));
      return false;
    }
  }
  
  // Return the store with additional methods
  return {
    subscribe,
    login,
    logout,
    generateNewKeys,
    loadUserFromSession,
    checkSession
  };
}

// Create the auth store instance
export const auth = createAuthStore();