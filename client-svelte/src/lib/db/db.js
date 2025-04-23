import Dexie from 'dexie';

// Define the database schema
class NodusDatabase extends Dexie {
  constructor() {
    super('nodus-db');
    
    // Define database schema with tables and indices
    this.version(1).stores({
      events: 'id, kind, pubkey, created_at, *tags', // Nostr events
      profiles: 'pubkey, updated_at', // User profiles
      userFollows: 'pubkey', // Follow lists by user
      userSettings: 'id, lastSync', // User settings
      user: '++id' // Current user information
    });
    
    // Define tables
    this.events = this.table('events');
    this.profiles = this.table('profiles');
    this.userFollows = this.table('userFollows');
    this.userSettings = this.table('userSettings');
    this.user = this.table('user');
  }
  
  // Events methods
  async storeEvent(event) {
    try {
      // Store the event
      await this.events.put(event);
      return event.id;
    } catch (err) {
      console.error('Failed to store event:', err);
      throw err;
    }
  }
  
  async getEventById(id) {
    try {
      return await this.events.get(id);
    } catch (err) {
      console.error('Failed to get event by id:', err);
      return null;
    }
  }
  
  async getEventsByKind(kind, limit = 50) {
    try {
      return await this.events
        .where('kind')
        .equals(kind)
        .reverse() // Most recent first
        .limit(limit)
        .toArray();
    } catch (err) {
      console.error('Failed to get events by kind:', err);
      return [];
    }
  }
  
  async getEventsByPubkey(pubkey, limit = 50) {
    try {
      return await this.events
        .where('pubkey')
        .equals(pubkey)
        .reverse() // Most recent first
        .limit(limit)
        .toArray();
    } catch (err) {
      console.error('Failed to get events by pubkey:', err);
      return [];
    }
  }
  
  // Profile methods
  async storeProfile(pubkey, profile) {
    try {
      await this.profiles.put({
        pubkey,
        ...profile,
        updated_at: Date.now()
      });
    } catch (err) {
      console.error('Failed to store profile:', err);
      throw err;
    }
  }
  
  async getProfile(pubkey) {
    try {
      return await this.profiles.get(pubkey);
    } catch (err) {
      console.error('Failed to get profile:', err);
      return null;
    }
  }
  
  // Following methods
  async storeUserFollows(pubkey, follows) {
    try {
      await this.userFollows.put({ pubkey, follows });
    } catch (err) {
      console.error('Failed to store user follows:', err);
      throw err;
    }
  }
  
  async getUserFollows(pubkey) {
    try {
      const data = await this.userFollows.get(pubkey);
      return data ? data.follows : [];
    } catch (err) {
      console.error('Failed to get user follows:', err);
      return [];
    }
  }
  
  // User methods
  async storeCurrentUser(user) {
    try {
      // Clear any existing users first (we only store one user)
      await this.user.clear();
      // Add the new user
      return await this.user.add(user);
    } catch (err) {
      console.error('Failed to store current user:', err);
      throw err;
    }
  }
  
  async getCurrentUser() {
    try {
      const users = await this.user.toArray();
      return users.length > 0 ? users[0] : null;
    } catch (err) {
      console.error('Failed to get current user:', err);
      return null;
    }
  }
  
  async clearCurrentUser() {
    try {
      await this.user.clear();
    } catch (err) {
      console.error('Failed to clear current user:', err);
      throw err;
    }
  }
  
  // Settings methods
  async setDarkMode(darkMode) {
    try {
      // Check if settings exist
      const settings = await this.userSettings.get(1);
      
      if (settings) {
        // Update existing settings
        await this.userSettings.update(1, { darkMode });
      } else {
        // Create new settings
        await this.userSettings.put({ id: 1, darkMode, lastSync: null });
      }
    } catch (err) {
      console.error('Failed to set dark mode:', err);
      throw err;
    }
  }
  
  async getDarkMode() {
    try {
      const settings = await this.userSettings.get(1);
      return settings ? settings.darkMode : false;
    } catch (err) {
      console.error('Failed to get dark mode:', err);
      return false;
    }
  }
  
  async updateLastSync() {
    try {
      // Check if settings exist
      const settings = await this.userSettings.get(1);
      const now = new Date();
      
      if (settings) {
        // Update existing settings
        await this.userSettings.update(1, { lastSync: now });
      } else {
        // Create new settings
        await this.userSettings.put({ id: 1, darkMode: false, lastSync: now });
      }
    } catch (err) {
      console.error('Failed to update last sync:', err);
      throw err;
    }
  }
  
  async getLastSync() {
    try {
      const settings = await this.userSettings.get(1);
      return settings ? settings.lastSync : null;
    } catch (err) {
      console.error('Failed to get last sync:', err);
      return null;
    }
  }
  
  // Cache management
  async clearCache() {
    try {
      // Clear all tables except the user
      await this.events.clear();
      await this.profiles.clear();
      await this.userFollows.clear();
      
      // Update last sync
      await this.updateLastSync();
    } catch (err) {
      console.error('Failed to clear cache:', err);
      throw err;
    }
  }
}

// Create and export the database instance
export const db = new NodusDatabase();