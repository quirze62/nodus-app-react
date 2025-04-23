import Dexie from 'dexie';

class NodusDatabase extends Dexie {
  constructor() {
    super('NodusDB');
    
    // Define tables and indexes
    this.version(1).stores({
      events: 'id, pubkey, kind, created_at, *tags',
      profiles: 'pubkey, name, displayName, nip05, updated_at',
      userFollows: 'pubkey',
      userSettings: 'id, darkMode, lastSync',
      user: 'id++'
    });
  }
  
  // Events methods
  async storeEvent(event) {
    try {
      // Ensure required fields
      if (!event.id || !event.pubkey) {
        throw new Error('Event missing required fields');
      }
      
      await this.events.put(event);
      return event.id;
    } catch (error) {
      console.error('Error storing event:', error);
      throw error;
    }
  }
  
  async getEventsByKind(kind, limit = 50) {
    try {
      return await this.events
        .where('kind')
        .equals(kind)
        .reverse()
        .limit(limit)
        .toArray();
    } catch (error) {
      console.error(`Error fetching events of kind ${kind}:`, error);
      return [];
    }
  }
  
  async getEventsByPubkey(pubkey, limit = 50) {
    try {
      return await this.events
        .where('pubkey')
        .equals(pubkey)
        .reverse()
        .limit(limit)
        .toArray();
    } catch (error) {
      console.error(`Error fetching events for pubkey ${pubkey}:`, error);
      return [];
    }
  }
  
  // Profile methods
  async storeProfile(pubkey, profile) {
    try {
      const profileData = {
        pubkey,
        ...profile,
        updated_at: new Date()
      };
      
      await this.profiles.put(profileData);
    } catch (error) {
      console.error('Error storing profile:', error);
      throw error;
    }
  }
  
  async getProfile(pubkey) {
    try {
      return await this.profiles.get(pubkey);
    } catch (error) {
      console.error(`Error fetching profile for ${pubkey}:`, error);
      return undefined;
    }
  }
  
  // User follows methods
  async storeUserFollows(pubkey, follows) {
    try {
      await this.userFollows.put({ pubkey, follows });
    } catch (error) {
      console.error('Error storing user follows:', error);
      throw error;
    }
  }
  
  async getUserFollows(pubkey) {
    try {
      const data = await this.userFollows.get(pubkey);
      return data?.follows || [];
    } catch (error) {
      console.error(`Error fetching follows for ${pubkey}:`, error);
      return [];
    }
  }
  
  // User authentication methods
  async storeCurrentUser(user) {
    try {
      // Reset all existing user records first
      await this.user.clear();
      // Then add the new user
      const id = await this.user.add(user);
      return id;
    } catch (error) {
      console.error('Error storing user:', error);
      throw error;
    }
  }
  
  async getCurrentUser() {
    try {
      // Get the first (and only) user
      const user = await this.user.toCollection().first();
      return user;
    } catch (error) {
      console.error('Error fetching current user:', error);
      return undefined;
    }
  }
  
  // User preferences/settings
  async setDarkMode(darkMode) {
    try {
      await this.userSettings.put({ id: 1, darkMode });
    } catch (error) {
      console.error('Error saving dark mode setting:', error);
      throw error;
    }
  }
  
  async getDarkMode() {
    try {
      const settings = await this.userSettings.get(1);
      // Default to system preference if setting doesn't exist
      return settings?.darkMode ?? false;
    } catch (error) {
      console.error('Error fetching dark mode setting:', error);
      return false;
    }
  }
  
  // Sync management
  async updateLastSync() {
    try {
      await this.userSettings.put({ id: 1, lastSync: new Date() });
    } catch (error) {
      console.error('Error updating last sync time:', error);
      throw error;
    }
  }
  
  async getLastSync() {
    try {
      const settings = await this.userSettings.get(1);
      return settings?.lastSync || null;
    } catch (error) {
      console.error('Error fetching last sync time:', error);
      return null;
    }
  }
  
  // Cache management
  async clearCache() {
    try {
      // Clear all tables except user and settings
      await this.events.clear();
      await this.profiles.clear();
      
      console.log('Cache cleared successfully');
    } catch (error) {
      console.error('Error clearing cache:', error);
      throw error;
    }
  }
}

export const db = new NodusDatabase();