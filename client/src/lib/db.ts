import Dexie from 'dexie';
import type { NostrEvent, NostrProfile, NostrUser } from './nostr';

// Define the Dexie database for local caching
class NodusDatabase extends Dexie {
  events: Dexie.Table<NostrEvent, string>;
  profiles: Dexie.Table<NostrProfile & { pubkey: string }, string>;
  userFollows: Dexie.Table<{ pubkey: string, follows: string[] }, string>;
  userSettings: Dexie.Table<{ id: number, darkMode: boolean, lastSync: Date }, number>;
  user: Dexie.Table<NostrUser, number>;
  nip05Cache: Dexie.Table<{ pubkey: string, verified: boolean, timestamp: number }, string>;

  constructor() {
    super('NodusDB');
    
    this.version(2).stores({
      events: 'id, pubkey, kind, created_at, *tags', // Store events with indexes
      profiles: 'pubkey, name', // Store profiles indexed by pubkey
      userFollows: 'pubkey', // Store user follows
      userSettings: 'id', // Store user settings
      user: '++id, publicKey, npub', // Store user info
      nip05Cache: 'pubkey, timestamp' // Store NIP-05 verification cache
    });
    
    this.events = this.table('events');
    this.profiles = this.table('profiles');
    this.userFollows = this.table('userFollows');
    this.userSettings = this.table('userSettings');
    this.user = this.table('user');
    this.nip05Cache = this.table('nip05Cache');
  }

  // Helper methods for common operations
  async storeEvent(event: NostrEvent): Promise<string> {
    try {
      await this.events.put(event);
      return event.id;
    } catch (error) {
      console.error('Error storing event:', error);
      throw error;
    }
  }

  async getEventsByKind(kind: number, limit = 50): Promise<NostrEvent[]> {
    try {
      return await this.events
        .where('kind')
        .equals(kind)
        .reverse() // Newest first
        .limit(limit)
        .toArray();
    } catch (error) {
      console.error(`Error getting events of kind ${kind}:`, error);
      return [];
    }
  }

  async getEventsByPubkey(pubkey: string, limit = 50): Promise<NostrEvent[]> {
    try {
      return await this.events
        .where('pubkey')
        .equals(pubkey)
        .reverse()
        .limit(limit)
        .toArray();
    } catch (error) {
      console.error(`Error getting events for pubkey ${pubkey}:`, error);
      return [];
    }
  }

  async storeProfile(pubkey: string, profile: NostrProfile): Promise<void> {
    try {
      await this.profiles.put({ pubkey, ...profile });
    } catch (error) {
      console.error('Error storing profile:', error);
      throw error;
    }
  }

  async getProfile(pubkey: string): Promise<(NostrProfile & { pubkey: string }) | undefined> {
    try {
      return await this.profiles.get(pubkey);
    } catch (error) {
      console.error(`Error getting profile for ${pubkey}:`, error);
      return undefined;
    }
  }

  async storeUserFollows(pubkey: string, follows: string[]): Promise<void> {
    try {
      await this.userFollows.put({ pubkey, follows });
    } catch (error) {
      console.error('Error storing user follows:', error);
      throw error;
    }
  }

  async getUserFollows(pubkey: string): Promise<string[]> {
    try {
      const record = await this.userFollows.get(pubkey);
      return record?.follows || [];
    } catch (error) {
      console.error(`Error getting follows for ${pubkey}:`, error);
      return [];
    }
  }

  async storeCurrentUser(user: NostrUser): Promise<number> {
    try {
      // First clear any existing user
      await this.user.clear();
      return await this.user.add(user);
    } catch (error) {
      console.error('Error storing current user:', error);
      throw error;
    }
  }

  async getCurrentUser(): Promise<NostrUser | undefined> {
    try {
      const users = await this.user.toArray();
      return users[0];
    } catch (error) {
      console.error('Error getting current user:', error);
      return undefined;
    }
  }

  async setDarkMode(darkMode: boolean): Promise<void> {
    try {
      const settings = await this.userSettings.get(1) || { id: 1, darkMode, lastSync: new Date() };
      settings.darkMode = darkMode;
      await this.userSettings.put(settings);
    } catch (error) {
      console.error('Error setting dark mode:', error);
      throw error;
    }
  }

  async getDarkMode(): Promise<boolean> {
    try {
      const settings = await this.userSettings.get(1);
      // Default to system preference if no setting is stored
      return settings?.darkMode ?? window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (error) {
      console.error('Error getting dark mode setting:', error);
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
  }

  async updateLastSync(): Promise<void> {
    try {
      const settings = await this.userSettings.get(1) || { id: 1, darkMode: false, lastSync: new Date() };
      settings.lastSync = new Date();
      await this.userSettings.put(settings);
    } catch (error) {
      console.error('Error updating last sync:', error);
      throw error;
    }
  }

  async getLastSync(): Promise<Date | null> {
    try {
      const settings = await this.userSettings.get(1);
      return settings?.lastSync || null;
    } catch (error) {
      console.error('Error getting last sync:', error);
      return null;
    }
  }

  async clearCache(): Promise<void> {
    try {
      await this.events.clear();
      await this.profiles.clear();
      await this.userFollows.clear();
      // Don't clear user settings or current user
    } catch (error) {
      console.error('Error clearing cache:', error);
      throw error;
    }
  }
  
  async clearCurrentUser(): Promise<void> {
    try {
      await this.user.clear();
    } catch (error) {
      console.error('Error clearing current user:', error);
      throw error;
    }
  }
}

export const db = new NodusDatabase();
