import Dexie from 'dexie';

/**
 * NodusDB: Local database implementation using Dexie (IndexedDB wrapper)
 * This provides local storage for a true local-first architecture
 */
class NodusDB extends Dexie {
  constructor() {
    super('NodusDB');
    
    // Define database schema with appropriate indexes
    this.version(1).stores({
      events: 'id, pubkey, kind, created_at, *tags',
      profiles: 'pubkey, updated_at',
      relays: 'url, added_at',
      settings: 'id',
      session: 'id'
    });
    
    // Add specific typing to tables
    this.events = this.table('events');
    this.profiles = this.table('profiles');
    this.relays = this.table('relays');
    this.settings = this.table('settings');
    this.session = this.table('session');
  }
  
  /**
   * Store a Nostr event in the local database
   */
  async storeEvent(event) {
    try {
      // Ensure the event has all required fields
      if (!event || !event.id || !event.pubkey) {
        console.error('Invalid event object:', event);
        return null;
      }
      
      // Add standard fields if missing
      const processedEvent = {
        ...event,
        created_at: event.created_at || Math.floor(Date.now() / 1000),
        tags: event.tags || [],
        content: event.content || '',
        sig: event.sig || ''
      };
      
      // Store or update the event
      return await this.events.put(processedEvent);
    } catch (error) {
      console.error('Error storing event:', error);
      return null;
    }
  }
  
  /**
   * Get events by kind with optional limit
   */
  async getEventsByKind(kind, limit = 50) {
    return await this.events
      .where('kind')
      .equals(kind)
      .reverse() // Newest first
      .limit(limit)
      .toArray();
  }
  
  /**
   * Get events by pubkey with optional limit
   */
  async getEventsByPubkey(pubkey, limit = 50) {
    return await this.events
      .where('pubkey')
      .equals(pubkey)
      .reverse() // Newest first
      .limit(limit)
      .toArray();
  }
  
  /**
   * Store user profile data
   */
  async storeProfile(pubkey, profile) {
    try {
      if (!pubkey || !profile) return false;
      
      const profileData = {
        pubkey,
        ...profile,
        updated_at: Date.now()
      };
      
      await this.profiles.put(profileData);
      return true;
    } catch (error) {
      console.error('Error storing profile:', error);
      return false;
    }
  }
  
  /**
   * Get a stored profile by pubkey
   */
  async getProfile(pubkey) {
    try {
      return await this.profiles.get(pubkey);
    } catch (error) {
      console.error('Error getting profile:', error);
      return null;
    }
  }
  
  /**
   * Store user's preferred relays
   */
  async storeRelay(url) {
    try {
      if (!url) return false;
      
      const relay = {
        url,
        added_at: Date.now()
      };
      
      await this.relays.put(relay);
      return true;
    } catch (error) {
      console.error('Error storing relay:', error);
      return false;
    }
  }
  
  /**
   * Get all stored relays
   */
  async getRelays() {
    try {
      return await this.relays.toArray();
    } catch (error) {
      console.error('Error getting relays:', error);
      return [];
    }
  }
  
  /**
   * Remove a relay by URL
   */
  async removeRelay(url) {
    try {
      await this.relays.delete(url);
      return true;
    } catch (error) {
      console.error('Error removing relay:', error);
      return false;
    }
  }
  
  /**
   * Store user settings
   */
  async storeSettings(settings) {
    try {
      const userSettings = {
        id: 1, // We only have one settings object
        ...settings,
        updated_at: Date.now()
      };
      
      await this.settings.put(userSettings);
      return true;
    } catch (error) {
      console.error('Error storing settings:', error);
      return false;
    }
  }
  
  /**
   * Get user settings
   */
  async getSettings() {
    try {
      return await this.settings.get(1) || {};
    } catch (error) {
      console.error('Error getting settings:', error);
      return {};
    }
  }
  
  /**
   * Store session data
   */
  async storeSession(data) {
    try {
      const session = {
        id: 1, // We only have one session
        ...data,
        updated_at: Date.now()
      };
      
      await this.session.put(session);
      return true;
    } catch (error) {
      console.error('Error storing session:', error);
      return false;
    }
  }
  
  /**
   * Get session data
   */
  async getSession() {
    try {
      return await this.session.get(1) || null;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }
  
  /**
   * Clear session data (logout)
   */
  async clearSession() {
    try {
      await this.session.clear();
      return true;
    } catch (error) {
      console.error('Error clearing session:', error);
      return false;
    }
  }
}

// Create database instance
const db = new NodusDB();

// Initialize the database
export async function initializeDb() {
  try {
    console.info('Initializing NodusDB...');
    
    // Pre-populate settings if needed
    const settings = await db.getSettings();
    if (!settings.id) {
      await db.storeSettings({
        theme: 'light',
        notifications: true,
        lastSynced: null
      });
    }
    
    console.info('NodusDB initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing NodusDB:', error);
    return false;
  }
}

export { db };