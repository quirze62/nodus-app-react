import { writable } from 'svelte/store';
import { generatePrivateKey, getPublicKey, finalizeEvent, getEventHash } from 'nostr-tools';
import { db } from '../db/db';
import { toast } from './toast';

// Define user type
/**
 * @typedef {Object} NostrUser
 * @property {string} privateKey - The user's private key
 * @property {string} pubkey - The user's public key
 * @property {Object|null} profile - The user's profile data
 */

// Create the auth store with initial state
const createAuthStore = () => {
  // Initial state
  const initialState = {
    isAuthenticated: false,
    isLoading: true,
    user: null,
    error: null
  };
  
  const { subscribe, set, update } = writable(initialState);
  
  // Initialize auth state
  const initialize = async () => {
    update(state => ({ ...state, isLoading: true }));
    
    try {
      // Try to load user from database
      const user = await db.getCurrentUser();
      
      if (user) {
        set({
          isAuthenticated: true,
          isLoading: false,
          user,
          error: null
        });
      } else {
        set({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: null
        });
      }
    } catch (error) {
      console.error("Error initializing auth:", error);
      set({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: error.message
      });
    }
  };
  
  // Login with private key
  const login = async (nsecOrPrivKey) => {
    update(state => ({ ...state, isLoading: true }));
    
    try {
      let privateKey = nsecOrPrivKey;
      
      // If it starts with nsec, convert it to hex
      if (nsecOrPrivKey.startsWith('nsec')) {
        try {
          // Decode nsec to get the raw private key
          const decoded = window.nostrTools.nip19.decode(nsecOrPrivKey);
          privateKey = decoded.data;
        } catch (e) {
          throw new Error('Invalid nsec format');
        }
      }
      
      // Generate public key from private key
      const pubkey = getPublicKey(privateKey);
      
      // Create user object
      const user = {
        privateKey,
        pubkey,
        profile: null
      };
      
      // Store in database
      await db.storeCurrentUser(user);
      
      // Update state
      set({
        isAuthenticated: true,
        isLoading: false,
        user,
        error: null
      });
      
      toast.success('Logged in successfully');
      return true;
    } catch (error) {
      console.error("Login error:", error);
      set({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: error.message
      });
      
      toast.error(`Login failed: ${error.message}`);
      return false;
    }
  };
  
  // Generate new keys
  const generateNewKeys = async () => {
    update(state => ({ ...state, isLoading: true }));
    
    try {
      // Generate new private key
      const privateKey = generatePrivateKey();
      
      // Get public key
      const pubkey = getPublicKey(privateKey);
      
      // Create user object
      const user = {
        privateKey,
        pubkey,
        profile: null
      };
      
      // Store in database
      await db.storeCurrentUser(user);
      
      // Update state
      set({
        isAuthenticated: true,
        isLoading: false,
        user,
        error: null
      });
      
      toast.success('New keys generated successfully');
      return user;
    } catch (error) {
      console.error("Error generating keys:", error);
      set({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: error.message
      });
      
      toast.error(`Failed to generate keys: ${error.message}`);
      throw error;
    }
  };
  
  // Update user profile
  const updateUserProfile = async (profile) => {
    update(state => {
      if (!state.user) return state;
      
      const updatedUser = {
        ...state.user,
        profile
      };
      
      // Store updated user
      db.storeCurrentUser(updatedUser).catch(err => 
        console.error("Error storing updated user:", err)
      );
      
      return {
        ...state,
        user: updatedUser
      };
    });
  };
  
  // Logout
  const logout = async () => {
    try {
      // Clear current user from db
      await db.session.clear();
      
      // Update state
      set({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null
      });
      
      toast.info('Logged out successfully');
    } catch (error) {
      console.error("Logout error:", error);
      toast.error(`Logout failed: ${error.message}`);
    }
  };
  
  // Sign an event
  const signEvent = (event) => {
    return update(state => {
      if (!state.user || !state.user.privateKey) {
        throw new Error('Not authenticated');
      }
      
      try {
        // Add created_at if not provided
        if (!event.created_at) {
          event.created_at = Math.floor(Date.now() / 1000);
        }
        
        // Add pubkey if not provided
        if (!event.pubkey) {
          event.pubkey = state.user.pubkey;
        }
        
        // Add id if not provided
        if (!event.id) {
          event.id = getEventHash(event);
        }
        
        // Sign the event
        const signedEvent = finalizeEvent(event, state.user.privateKey);
        
        return state;
      } catch (error) {
        console.error("Error signing event:", error);
        throw error;
      }
    });
  };
  
  // Initialize on creation
  initialize().catch(err => console.error("Auth initialization error:", err));
  
  return {
    subscribe,
    login,
    logout,
    generateNewKeys,
    updateUserProfile,
    signEvent,
    initialize
  };
};

// Create and export the store
export const auth = createAuthStore();