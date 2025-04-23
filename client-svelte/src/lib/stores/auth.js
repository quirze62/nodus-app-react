import { writable, derived } from 'svelte/store';
import { ndkStore } from '../services/ndk-config.js';
import { nip19 } from 'nostr-tools';

// User type definition
/**
 * @typedef {Object} User
 * @property {string} pubkey - User's public key
 * @property {string} npub - User's npub (encoded public key)
 * @property {string} privateKey - User's private key (encrypted or null)
 * @property {Object} profile - User profile data
 */

// Initial state
const initialState = {
  user: null,
  isLoading: false,
  error: null
};

// Create the writable store
const authStore = writable(initialState);

// Create derived stores for commonly used values
export const user = derived(authStore, $auth => $auth.user);
export const isAuthenticated = derived(authStore, $auth => !!$auth.user);
export const isLoading = derived(authStore, $auth => $auth.isLoading);
export const error = derived(authStore, $auth => $auth.error);

// Load user from localStorage on initialization
const loadUserFromStorage = () => {
  if (typeof window === 'undefined') return;
  
  try {
    const storedUser = localStorage.getItem('nodus_user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      authStore.update(state => ({ ...state, user }));
    }
  } catch (error) {
    console.error('Failed to load user from localStorage:', error);
  }
};

// Initialize the store
loadUserFromStorage();

/**
 * Login with a private key
 * @param {string} privateKey - User's private key (nsec or hex)
 * @returns {Promise<boolean>} Success status
 */
export const login = async (privateKey) => {
  authStore.update(state => ({ ...state, isLoading: true, error: null }));
  
  try {
    let ndk;
    ndkStore.subscribe(value => ndk = value)();
    
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    // Check if the privateKey is an nsec, and decode if needed
    let hexPrivateKey = privateKey;
    if (privateKey.startsWith('nsec')) {
      try {
        const decoded = nip19.decode(privateKey);
        hexPrivateKey = decoded.data;
      } catch (error) {
        throw new Error('Invalid nsec format');
      }
    }
    
    // Create a user with this private key
    const user = await ndk.signer.user({
      privateKey: hexPrivateKey
    });
    
    // Get the public key
    const pubkey = await user.publicKey;
    
    // Encode public key to npub
    const npub = nip19.npubEncode(pubkey);
    
    // Fetch user profile
    const profile = await fetchUserProfile(pubkey, ndk);
    
    // Create user object
    const userData = {
      pubkey,
      npub,
      privateKey: hexPrivateKey, // Note: In a real app, encrypt this or use a hardware signer
      profile
    };
    
    // Save to store
    authStore.update(state => ({ 
      ...state, 
      user: userData,
      isLoading: false
    }));
    
    // Save to localStorage for persistence
    localStorage.setItem('nodus_user', JSON.stringify(userData));
    
    return true;
  } catch (error) {
    console.error('Login failed:', error);
    authStore.update(state => ({ 
      ...state, 
      error: error.message || 'Login failed',
      isLoading: false
    }));
    return false;
  }
};

/**
 * Generate a new key pair for a new user
 * @returns {Promise<User>} New user object
 */
export const generateNewKeys = async () => {
  authStore.update(state => ({ ...state, isLoading: true, error: null }));
  
  try {
    let ndk;
    ndkStore.subscribe(value => ndk = value)();
    
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    // Generate a new key pair
    const { privateKey, publicKey } = window.nostr.generateKeyPair();
    
    // Encode public key to npub
    const npub = nip19.npubEncode(publicKey);
    
    // Create empty profile
    const profile = {
      name: 'New User',
      about: '',
      picture: '',
      displayName: 'New User',
      nip05: ''
    };
    
    // Create user object
    const userData = {
      pubkey: publicKey,
      npub,
      privateKey,
      profile
    };
    
    // Save to store
    authStore.update(state => ({ 
      ...state, 
      user: userData,
      isLoading: false
    }));
    
    // Save to localStorage for persistence
    localStorage.setItem('nodus_user', JSON.stringify(userData));
    
    return userData;
  } catch (error) {
    console.error('Key generation failed:', error);
    authStore.update(state => ({ 
      ...state, 
      error: error.message || 'Key generation failed',
      isLoading: false
    }));
    throw error;
  }
};

/**
 * Logout the current user
 */
export const logout = () => {
  authStore.update(state => ({ 
    ...state, 
    user: null,
    isLoading: false,
    error: null
  }));
  
  // Remove from localStorage
  localStorage.removeItem('nodus_user');
};

/**
 * Fetch a user's profile
 * @param {string} pubkey - User's public key
 * @param {NDK} ndk - NDK instance
 * @returns {Promise<Object>} User profile
 */
const fetchUserProfile = async (pubkey, ndk) => {
  try {
    // Fetch user profile (kind 0)
    const profileEvent = await ndk.fetchEvent({
      kinds: [0],
      authors: [pubkey]
    });
    
    if (profileEvent) {
      return JSON.parse(profileEvent.content);
    }
    
    // Return default profile if none exists
    return {
      name: 'Unknown User',
      about: '',
      picture: '',
      displayName: 'Unknown User',
      nip05: ''
    };
  } catch (error) {
    console.error('Error fetching profile:', error);
    // Return default profile on error
    return {
      name: 'Unknown User',
      about: '',
      picture: '',
      displayName: 'Unknown User',
      nip05: ''
    };
  }
};