import Dexie from 'dexie';

// Define our Dexie database class
class NodusDatabase extends Dexie {
  constructor() {
    super('nodus-db');
    
    // Define database schema
    this.version(1).stores({
      events: 'id, pubkey, kind, created_at, [pubkey+kind]',
      profiles: 'pubkey',
      session: 'id',
      settings: 'id',
      relays: 'url'
    });
    
    // Define table types
    this.events = this.table('events');
    this.profiles = this.table('profiles');
    this.session = this.table('session');
    this.settings = this.table('settings');
    this.relays = this.table('relays');
  }
  
  /* Event methods */
  
  // Store a Nostr event
  async storeEvent(event) {
    if (!event || !event.id) return null;
    
    try {
      await this.events.put(event);
      return event.id;
    } catch (error) {
      console.error('Error storing event:', error);
      throw error;
    }
  }
  
  // Store multiple events
  async storeEvents(events) {
    if (!events || !events.length) return [];
    
    try {
      await this.events.bulkPut(events);
      return events.map(e => e.id);
    } catch (error) {
      console.error('Error storing events:', error);
      throw error;
    }
  }
  
  // Get event by ID
  async getEvent(id) {
    if (!id) return null;
    
    try {
      return await this.events.get(id);
    } catch (error) {
      console.error(`Error getting event ${id}:`, error);
      throw error;
    }
  }
  
  // Get events by kind
  async getEventsByKind(kind, limit = 50) {
    try {
      return await this.events
        .where('kind')
        .equals(kind)
        .reverse() // Most recent first
        .limit(limit)
        .toArray();
    } catch (error) {
      console.error(`Error getting events of kind ${kind}:`, error);
      throw error;
    }
  }
  
  // Get events by pubkey
  async getEventsByPubkey(pubkey, limit = 50) {
    if (!pubkey) return [];
    
    try {
      return await this.events
        .where('pubkey')
        .equals(pubkey)
        .reverse() // Most recent first
        .limit(limit)
        .toArray();
    } catch (error) {
      console.error(`Error getting events for pubkey ${pubkey}:`, error);
      throw error;
    }
  }
  
  // Get events by pubkey and kind
  async getEventsByPubkeyAndKind(pubkey, kind, limit = 50) {
    if (!pubkey) return [];
    
    try {
      return await this.events
        .where('[pubkey+kind]')
        .equals([pubkey, kind])
        .reverse() // Most recent first
        .limit(limit)
        .toArray();
    } catch (error) {
      console.error(`Error getting events for pubkey ${pubkey} and kind ${kind}:`, error);
      throw error;
    }
  }
  
  /* Profile methods */
  
  // Store a profile
  async storeProfile(pubkey, profile) {
    if (!pubkey || !profile) return false;
    
    try {
      await this.profiles.put({
        pubkey,
        ...profile,
        updated_at: Date.now()
      });
      return true;
    } catch (error) {
      console.error(`Error storing profile for ${pubkey}:`, error);
      throw error;
    }
  }
  
  // Get a profile
  async getProfile(pubkey) {
    if (!pubkey) return null;
    
    try {
      return await this.profiles.get(pubkey);
    } catch (error) {
      console.error(`Error getting profile for ${pubkey}:`, error);
      throw error;
    }
  }
  
  /* Session methods */
  
  // Store the current user
  async storeCurrentUser(user) {
    if (!user || !user.pubkey) return false;
    
    try {
      await this.session.put({
        id: 1, // Only one user session at a time
        ...user,
        updated_at: Date.now()
      });
      return true;
    } catch (error) {
      console.error('Error storing current user:', error);
      throw error;
    }
  }
  
  // Get the current user
  async getCurrentUser() {
    try {
      return await this.session.get(1);
    } catch (error) {
      console.error('Error getting current user:', error);
      throw error;
    }
  }
  
  /* Settings methods */
  
  // Set theme
  async setTheme(theme) {
    try {
      const settings = await this.settings.get(1) || { id: 1 };
      settings.theme = theme;
      settings.updated_at = Date.now();
      
      await this.settings.put(settings);
      return true;
    } catch (error) {
      console.error('Error setting theme:', error);
      throw error;
    }
  }
  
  // Get theme
  async getTheme() {
    try {
      const settings = await this.settings.get(1);
      return settings?.theme || 'system';
    } catch (error) {
      console.error('Error getting theme:', error);
      throw error;
    }
  }
  
  // Update last sync time
  async updateLastSync() {
    try {
      const settings = await this.settings.get(1) || { id: 1 };
      settings.lastSync = new Date();
      settings.updated_at = Date.now();
      
      await this.settings.put(settings);
      return true;
    } catch (error) {
      console.error('Error updating last sync:', error);
      throw error;
    }
  }
  
  // Get last sync time
  async getLastSync() {
    try {
      const settings = await this.settings.get(1);
      return settings?.lastSync || null;
    } catch (error) {
      console.error('Error getting last sync:', error);
      throw error;
    }
  }
  
  /* Relay methods */
  
  // Store a relay
  async storeRelay(url, read = true, write = true) {
    if (!url) return false;
    
    try {
      await this.relays.put({
        url,
        read,
        write,
        updated_at: Date.now()
      });
      return true;
    } catch (error) {
      console.error(`Error storing relay ${url}:`, error);
      throw error;
    }
  }
  
  // Get all relays
  async getRelays() {
    try {
      return await this.relays.toArray();
    } catch (error) {
      console.error('Error getting relays:', error);
      throw error;
    }
  }
  
  // Remove a relay
  async removeRelay(url) {
    if (!url) return false;
    
    try {
      await this.relays.delete(url);
      return true;
    } catch (error) {
      console.error(`Error removing relay ${url}:`, error);
      throw error;
    }
  }
  
  // Update relay status
  async updateRelayStatus(url, connected) {
    if (!url) return false;
    
    try {
      const relay = await this.relays.get(url);
      
      if (relay) {
        relay.connected = connected;
        relay.updated_at = Date.now();
        
        await this.relays.put(relay);
      }
      
      return true;
    } catch (error) {
      console.error(`Error updating relay status for ${url}:`, error);
      throw error;
    }
  }
}

// Create and export database instance
export const db = new NodusDatabase();