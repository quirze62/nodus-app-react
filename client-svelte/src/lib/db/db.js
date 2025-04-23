import Dexie from 'dexie';

/**
 * Nodus Database Class
 * Handles local storage of events, profiles, and user settings using IndexedDB
 */
class NodusDatabase extends Dexie {
  constructor() {
    super('nodus_db');
    
    // Define database schema
    this.version(1).stores({
      events: '&id, kind, pubkey, created_at, *tags',
      profiles: '&pubkey, updated_at, name, displayName, nip05',
      relays: '&url, added_at, priority',
      userSettings: '++id, darkMode, lastSync',
      userFollows: '&pubkey, *follows',
    });
    
    // Initialize tables
    this.events = this.table('events');
    this.profiles = this.table('profiles');
    this.relays = this.table('relays');
    this.userSettings = this.table('userSettings');
    this.userFollows = this.table('userFollows');
  }
  
  /**
   * Store a nostr event in the database
   * @param {Object} event - Nostr event object
   * @returns {Promise<string>} - Event ID
   */
  async storeEvent(event) {
    if (!event || !event.id) {
      throw new Error('Invalid event');
    }
    
    // Add or update the event
    try {
      await this.events.put(event);
      return event.id;
    } catch (error) {
      console.error('Failed to store event:', error);
      throw error;
    }
  }
  
  /**
   * Get events by kind
   * @param {number} kind - Event kind
   * @param {number} limit - Max number of events to return
   * @returns {Promise<Array>} - Array of events
   */
  async getEventsByKind(kind, limit = 50) {
    try {
      return await this.events
        .where('kind')
        .equals(kind)
        .reverse() // Latest first
        .limit(limit)
        .toArray();
    } catch (error) {
      console.error(`Failed to get events by kind ${kind}:`, error);
      return [];
    }
  }
  
  /**
   * Get events by pubkey (author)
   * @param {string} pubkey - Author's public key
   * @param {number} limit - Max number of events to return
   * @returns {Promise<Array>} - Array of events
   */
  async getEventsByPubkey(pubkey, limit = 50) {
    try {
      return await this.events
        .where('pubkey')
        .equals(pubkey)
        .reverse() // Latest first
        .limit(limit)
        .toArray();
    } catch (error) {
      console.error(`Failed to get events by pubkey ${pubkey}:`, error);
      return [];
    }
  }
  
  /**
   * Store a user profile
   * @param {string} pubkey - User's public key
   * @param {Object} profile - Profile data
   * @returns {Promise<void>}
   */
  async storeProfile(pubkey, profile) {
    if (!pubkey || !profile) {
      throw new Error('Invalid profile data');
    }
    
    try {
      await this.profiles.put({
        ...profile,
        pubkey,
        updated_at: Date.now()
      });
    } catch (error) {
      console.error('Failed to store profile:', error);
      throw error;
    }
  }
  
  /**
   * Get a user profile
   * @param {string} pubkey - User's public key
   * @returns {Promise<Object|undefined>} - Profile data or undefined
   */
  async getProfile(pubkey) {
    if (!pubkey) return undefined;
    
    try {
      return await this.profiles.get(pubkey);
    } catch (error) {
      console.error(`Failed to get profile for ${pubkey}:`, error);
      return undefined;
    }
  }
  
  /**
   * Store user's followed pubkeys
   * @param {string} pubkey - User's public key
   * @param {Array<string>} follows - Array of followed pubkeys
   * @returns {Promise<void>}
   */
  async storeUserFollows(pubkey, follows) {
    if (!pubkey || !Array.isArray(follows)) {
      throw new Error('Invalid follow data');
    }
    
    try {
      await this.userFollows.put({ pubkey, follows });
    } catch (error) {
      console.error('Failed to store user follows:', error);
      throw error;
    }
  }
  
  /**
   * Get user's followed pubkeys
   * @param {string} pubkey - User's public key
   * @returns {Promise<Array<string>>} - Array of followed pubkeys
   */
  async getUserFollows(pubkey) {
    if (!pubkey) return [];
    
    try {
      const followData = await this.userFollows.get(pubkey);
      return followData?.follows || [];
    } catch (error) {
      console.error(`Failed to get follows for ${pubkey}:`, error);
      return [];
    }
  }
  
  /**
   * Store a relay
   * @param {string} url - Relay URL
   * @param {number} priority - Relay priority (1=primary, 2=secondary, etc)
   * @returns {Promise<void>}
   */
  async storeRelay(url, priority = 1) {
    if (!url) throw new Error('Invalid relay URL');
    
    try {
      await this.relays.put({
        url,
        priority,
        added_at: Date.now()
      });
    } catch (error) {
      console.error('Failed to store relay:', error);
      throw error;
    }
  }
  
  /**
   * Get all stored relays
   * @returns {Promise<Array>} - Array of relay objects
   */
  async getRelays() {
    try {
      return await this.relays
        .orderBy('priority')
        .toArray();
    } catch (error) {
      console.error('Failed to get relays:', error);
      return [];
    }
  }
  
  /**
   * Remove a relay
   * @param {string} url - Relay URL
   * @returns {Promise<void>}
   */
  async removeRelay(url) {
    if (!url) throw new Error('Invalid relay URL');
    
    try {
      await this.relays.delete(url);
    } catch (error) {
      console.error(`Failed to remove relay ${url}:`, error);
      throw error;
    }
  }
  
  /**
   * Set dark mode preference
   * @param {boolean} darkMode - Whether dark mode is enabled
   * @returns {Promise<void>}
   */
  async setDarkMode(darkMode) {
    try {
      const settings = await this.userSettings.toCollection().first();
      
      if (settings) {
        await this.userSettings.update(settings.id, { darkMode });
      } else {
        await this.userSettings.add({ darkMode, lastSync: null });
      }
    } catch (error) {
      console.error('Failed to set dark mode:', error);
      throw error;
    }
  }
  
  /**
   * Get dark mode preference
   * @returns {Promise<boolean>} - Whether dark mode is enabled
   */
  async getDarkMode() {
    try {
      const settings = await this.userSettings.toCollection().first();
      return settings?.darkMode || false;
    } catch (error) {
      console.error('Failed to get dark mode setting:', error);
      return false;
    }
  }
  
  /**
   * Update last sync timestamp
   * @returns {Promise<void>}
   */
  async updateLastSync() {
    try {
      const settings = await this.userSettings.toCollection().first();
      
      if (settings) {
        await this.userSettings.update(settings.id, { lastSync: new Date() });
      } else {
        await this.userSettings.add({ darkMode: false, lastSync: new Date() });
      }
    } catch (error) {
      console.error('Failed to update last sync:', error);
      throw error;
    }
  }
  
  /**
   * Get last sync timestamp
   * @returns {Promise<Date|null>} - Last sync timestamp or null
   */
  async getLastSync() {
    try {
      const settings = await this.userSettings.toCollection().first();
      return settings?.lastSync || null;
    } catch (error) {
      console.error('Failed to get last sync:', error);
      return null;
    }
  }
  
  /**
   * Clear all cached data
   * @returns {Promise<void>}
   */
  async clearCache() {
    try {
      await this.events.clear();
      await this.profiles.clear();
      console.log('Cache cleared');
    } catch (error) {
      console.error('Failed to clear cache:', error);
      throw error;
    }
  }
}

// Create and export database instance
export const db = new NodusDatabase();