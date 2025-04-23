<script>
  import { onMount } from 'svelte';
  import { user } from '../lib/stores/auth.js';
  import { theme, setTheme, THEMES } from '../lib/stores/theme.js';
  import { db } from '../lib/db/db.js';
  
  let currentUser;
  let currentTheme;
  let isLoading = true;
  let syncTime = null;
  let errorMessage = '';
  let successMessage = '';
  
  // Relay management
  let relays = [];
  let newRelayUrl = '';
  let isAddingRelay = false;
  
  // Subscribe to user and theme changes
  const unsubUser = user.subscribe(value => {
    currentUser = value;
  });
  
  const unsubTheme = theme.subscribe(value => {
    currentTheme = value;
  });
  
  onMount(async () => {
    try {
      // Get last sync time
      syncTime = await db.getLastSync();
      
      // Simulate relay loading
      setTimeout(() => {
        relays = [
          { url: 'wss://relay.mynodus.com', connected: true },
          { url: 'wss://relay.damus.io', connected: true },
          { url: 'wss://nos.lol', connected: false }
        ];
        isLoading = false;
      }, 1000);
    } catch (error) {
      console.error('Error loading settings:', error);
      errorMessage = 'Failed to load settings.';
      isLoading = false;
    }
  });
  
  function handleThemeChange(newTheme) {
    try {
      setTheme(newTheme);
      successMessage = 'Theme updated successfully.';
      setTimeout(() => {
        successMessage = '';
      }, 3000);
    } catch (error) {
      console.error('Error changing theme:', error);
      errorMessage = 'Failed to update theme.';
    }
  }
  
  async function handleAddRelay() {
    if (!newRelayUrl.trim() || !newRelayUrl.startsWith('wss://')) {
      errorMessage = 'Please enter a valid relay URL (must start with wss://).';
      return;
    }
    
    try {
      isAddingRelay = true;
      errorMessage = '';
      
      // Simulate relay addition delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if relay already exists
      const exists = relays.some(relay => relay.url === newRelayUrl);
      if (exists) {
        errorMessage = 'This relay is already in your list.';
        isAddingRelay = false;
        return;
      }
      
      // Add new relay
      relays = [...relays, { url: newRelayUrl, connected: false }];
      newRelayUrl = '';
      
      successMessage = 'Relay added successfully. Connecting...';
      
      // Simulate connection after 2 seconds
      setTimeout(() => {
        relays = relays.map(relay => {
          if (relay.url === newRelayUrl) {
            return { ...relay, connected: true };
          }
          return relay;
        });
        
        successMessage = 'Relay connected successfully.';
        setTimeout(() => {
          successMessage = '';
        }, 3000);
      }, 2000);
      
      isAddingRelay = false;
    } catch (error) {
      console.error('Error adding relay:', error);
      errorMessage = 'Failed to add relay.';
      isAddingRelay = false;
    }
  }
  
  async function handleRemoveRelay(url) {
    try {
      // Remove relay from list
      relays = relays.filter(relay => relay.url !== url);
      
      successMessage = 'Relay removed successfully.';
      setTimeout(() => {
        successMessage = '';
      }, 3000);
    } catch (error) {
      console.error('Error removing relay:', error);
      errorMessage = 'Failed to remove relay.';
    }
  }
  
  async function handleLogout() {
    try {
      await user.logout();
      // Navigation will happen automatically due to the auth state change
    } catch (error) {
      console.error('Error logging out:', error);
      errorMessage = 'Failed to log out.';
    }
  }
  
  async function handleClearCache() {
    try {
      await db.clearCache();
      await db.updateLastSync();
      syncTime = await db.getLastSync();
      
      successMessage = 'Cache cleared successfully.';
      setTimeout(() => {
        successMessage = '';
      }, 3000);
    } catch (error) {
      console.error('Error clearing cache:', error);
      errorMessage = 'Failed to clear cache.';
    }
  }
  
  function formatDate(date) {
    if (!date) return 'Never';
    
    return new Date(date).toLocaleString();
  }
</script>

<div class="settings-container">
  <h1>Settings</h1>
  
  {#if errorMessage}
    <div class="error-message">
      {errorMessage}
    </div>
  {/if}
  
  {#if successMessage}
    <div class="success-message">
      {successMessage}
    </div>
  {/if}
  
  {#if isLoading}
    <div class="loading">
      <p>Loading settings...</p>
    </div>
  {:else}
    <div class="settings-sections">
      <section class="settings-section">
        <h2>Appearance</h2>
        
        <div class="setting-item">
          <div class="setting-label">Theme</div>
          <div class="setting-control theme-selector">
            <button 
              class="theme-option" 
              class:active={currentTheme === THEMES.LIGHT}
              on:click={() => handleThemeChange(THEMES.LIGHT)}
            >
              Light
            </button>
            <button 
              class="theme-option" 
              class:active={currentTheme === THEMES.DARK}
              on:click={() => handleThemeChange(THEMES.DARK)}
            >
              Dark
            </button>
            <button 
              class="theme-option" 
              class:active={currentTheme === THEMES.SYSTEM}
              on:click={() => handleThemeChange(THEMES.SYSTEM)}
            >
              System
            </button>
          </div>
        </div>
      </section>
      
      <section class="settings-section">
        <h2>Relays</h2>
        <p class="section-description">
          Relays are servers that store and distribute Nostr content.
        </p>
        
        <div class="relay-list">
          {#if relays.length === 0}
            <div class="empty-state">
              <p>No relays configured. Add a relay to get started.</p>
            </div>
          {:else}
            {#each relays as relay}
              <div class="relay-item">
                <div class="relay-info">
                  <div class="relay-url">{relay.url}</div>
                  <div class="relay-status" class:connected={relay.connected}>
                    {relay.connected ? 'Connected' : 'Disconnected'}
                  </div>
                </div>
                <button class="remove-button" on:click={() => handleRemoveRelay(relay.url)}>
                  Remove
                </button>
              </div>
            {/each}
          {/if}
        </div>
        
        <div class="add-relay-form">
          <input 
            type="text" 
            placeholder="wss://relay.example.com" 
            bind:value={newRelayUrl}
            disabled={isAddingRelay}
          />
          <button 
            on:click={handleAddRelay}
            disabled={isAddingRelay || !newRelayUrl.trim()}
          >
            {isAddingRelay ? 'Adding...' : 'Add Relay'}
          </button>
        </div>
      </section>
      
      <section class="settings-section">
        <h2>Data Management</h2>
        
        <div class="setting-item">
          <div class="setting-label">Last synced</div>
          <div class="setting-value">{formatDate(syncTime)}</div>
        </div>
        
        <button class="action-button" on:click={handleClearCache}>
          Clear Cache
        </button>
        <p class="help-text">
          This will clear all cached events and profiles. Your user account and settings will be preserved.
        </p>
      </section>
      
      <section class="settings-section">
        <h2>Account</h2>
        
        {#if currentUser}
          <div class="setting-item">
            <div class="setting-label">Public Key</div>
            <div class="setting-value pubkey">
              {currentUser.pubkey.slice(0, 12)}...{currentUser.pubkey.slice(-12)}
            </div>
          </div>
        {/if}
        
        <button class="danger-button" on:click={handleLogout}>
          Log Out
        </button>
      </section>
    </div>
  {/if}
</div>

<style>
  .settings-container {
    max-width: 800px;
    margin: 0 auto;
    padding-bottom: 40px;
  }
  
  h1 {
    margin-bottom: 24px;
    font-size: 28px;
    font-weight: 600;
  }
  
  .loading {
    text-align: center;
    padding: 40px 0;
    color: #666;
  }
  
  :global(body.dark) .loading {
    color: #aaa;
  }
  
  .error-message {
    background-color: #ffeeee;
    color: #d32f2f;
    padding: 12px;
    border-radius: 6px;
    margin-bottom: 20px;
    border-left: 4px solid #d32f2f;
  }
  
  :global(body.dark) .error-message {
    background-color: rgba(211, 47, 47, 0.2);
    color: #ff6b6b;
  }
  
  .success-message {
    background-color: #e8f5e9;
    color: #2e7d32;
    padding: 12px;
    border-radius: 6px;
    margin-bottom: 20px;
    border-left: 4px solid #2e7d32;
  }
  
  :global(body.dark) .success-message {
    background-color: rgba(46, 125, 50, 0.2);
    color: #81c784;
  }
  
  .settings-sections {
    display: flex;
    flex-direction: column;
    gap: 32px;
  }
  
  .settings-section {
    background-color: white;
    border-radius: 8px;
    padding: 24px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  :global(body.dark) .settings-section {
    background-color: var(--bg-dark);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  
  .settings-section h2 {
    margin-top: 0;
    margin-bottom: 16px;
    font-size: 20px;
    font-weight: 600;
  }
  
  .section-description {
    margin-top: -8px;
    margin-bottom: 16px;
    color: #666;
    font-size: 14px;
  }
  
  :global(body.dark) .section-description {
    color: #aaa;
  }
  
  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid #eee;
  }
  
  :global(body.dark) .setting-item {
    border-bottom-color: #333;
  }
  
  .setting-item:last-child {
    border-bottom: none;
  }
  
  .setting-label {
    font-weight: 500;
  }
  
  .setting-value {
    color: #666;
  }
  
  :global(body.dark) .setting-value {
    color: #aaa;
  }
  
  .pubkey {
    font-family: monospace;
  }
  
  .theme-selector {
    display: flex;
    gap: 8px;
  }
  
  .theme-option {
    background-color: #f5f5f5;
    color: #333;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 8px 12px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  :global(body.dark) .theme-option {
    background-color: #333;
    color: #eee;
    border-color: #444;
  }
  
  .theme-option.active {
    background-color: var(--primary-color);
    color: white;
    border-color: var(--primary-color);
  }
  
  .relay-list {
    margin-bottom: 20px;
  }
  
  .empty-state {
    text-align: center;
    padding: 20px;
    background-color: #f5f5f5;
    border-radius: 6px;
    color: #666;
    margin-bottom: 20px;
  }
  
  :global(body.dark) .empty-state {
    background-color: #333;
    color: #aaa;
  }
  
  .relay-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    border: 1px solid #eee;
    border-radius: 6px;
    margin-bottom: 12px;
  }
  
  :global(body.dark) .relay-item {
    border-color: #333;
  }
  
  .relay-info {
    flex: 1;
  }
  
  .relay-url {
    font-family: monospace;
    margin-bottom: 4px;
  }
  
  .relay-status {
    font-size: 12px;
    color: #d32f2f;
  }
  
  .relay-status.connected {
    color: #2e7d32;
  }
  
  :global(body.dark) .relay-status {
    color: #ff6b6b;
  }
  
  :global(body.dark) .relay-status.connected {
    color: #81c784;
  }
  
  .remove-button {
    background-color: transparent;
    color: #d32f2f;
    border: 1px solid #d32f2f;
    padding: 6px 12px;
    font-size: 12px;
    border-radius: 4px;
  }
  
  .remove-button:hover {
    background-color: rgba(211, 47, 47, 0.1);
  }
  
  .add-relay-form {
    display: flex;
    gap: 12px;
  }
  
  .add-relay-form input {
    flex: 1;
  }
  
  .action-button {
    background-color: #f5f5f5;
    color: #333;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 8px 16px;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 16px;
    width: auto;
    align-self: flex-start;
  }
  
  :global(body.dark) .action-button {
    background-color: #333;
    color: #eee;
    border-color: #444;
  }
  
  .action-button:hover {
    background-color: #e0e0e0;
  }
  
  :global(body.dark) .action-button:hover {
    background-color: #444;
  }
  
  .danger-button {
    background-color: #d32f2f;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 8px 16px;
    cursor: pointer;
    transition: opacity 0.2s;
    margin-top: 16px;
  }
  
  .danger-button:hover {
    opacity: 0.9;
  }
  
  .help-text {
    margin-top: 8px;
    font-size: 12px;
    color: #666;
  }
  
  :global(body.dark) .help-text {
    color: #aaa;
  }
</style>