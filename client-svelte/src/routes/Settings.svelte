<script>
  import { onMount } from 'svelte';
  import Layout from '../components/Layout.svelte';
  import { theme, setTheme, THEMES } from '../lib/stores/theme.js';
  import { logout, isAuthenticated } from '../lib/stores/auth.js';
  import { getRelayStatus, addRelay, removeRelay } from '../lib/services/ndk-config.js';
  
  let relays = [];
  let isLoadingRelays = false;
  let newRelayUrl = '';
  let relayError = null;
  
  onMount(async () => {
    await loadRelays();
  });
  
  // Function to load relay status
  async function loadRelays() {
    isLoadingRelays = true;
    relays = await getRelayStatus();
    isLoadingRelays = false;
  }
  
  // Function to add a new relay
  async function handleAddRelay() {
    if (!newRelayUrl) return;
    
    relayError = null;
    
    // Basic validation
    if (!newRelayUrl.startsWith('wss://')) {
      relayError = 'Relay URL must start with wss://';
      return;
    }
    
    isLoadingRelays = true;
    
    try {
      const success = await addRelay(newRelayUrl);
      
      if (success) {
        newRelayUrl = '';
        await loadRelays();
      } else {
        relayError = 'Failed to add relay';
      }
    } catch (err) {
      console.error('Error adding relay:', err);
      relayError = err.message || 'Failed to add relay';
    } finally {
      isLoadingRelays = false;
    }
  }
  
  // Function to remove a relay
  async function handleRemoveRelay(url) {
    isLoadingRelays = true;
    
    try {
      const success = await removeRelay(url);
      
      if (success) {
        await loadRelays();
      }
    } catch (err) {
      console.error('Error removing relay:', err);
    } finally {
      isLoadingRelays = false;
    }
  }
  
  // Function to handle logout
  function handleLogout() {
    logout();
    window.location.href = '/';
  }
</script>

<Layout title="Settings">
  <div class="settings-page">
    <div class="section card">
      <h3>Appearance</h3>
      
      <div class="setting-group">
        <label>Theme</label>
        <div class="setting-controls">
          <select bind:value={$theme} on:change={() => setTheme($theme)}>
            <option value={THEMES.LIGHT}>Light</option>
            <option value={THEMES.DARK}>Dark</option>
            <option value={THEMES.SYSTEM}>System Default</option>
          </select>
        </div>
      </div>
    </div>
    
    <div class="section card">
      <h3>Relays</h3>
      <p class="help-text">
        Relays are servers that store and route Nostr events. Add or remove relays to customize your network.
      </p>
      
      {#if isLoadingRelays}
        <div class="spinner"></div>
      {:else}
        <ul class="relay-list">
          {#each relays as relay}
            <li class="relay-item">
              <div class="relay-info">
                <span class="relay-url">{relay.url}</span>
                <span class="relay-status" class:connected={relay.connected}>
                  {relay.connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <button class="btn-icon" on:click={() => handleRemoveRelay(relay.url)} title="Remove relay">
                ✕
              </button>
            </li>
          {/each}
        </ul>
        
        <div class="relay-form">
          <div class="input-group">
            <input 
              type="text" 
              bind:value={newRelayUrl} 
              placeholder="wss://relay.example.com" 
            />
            <button class="btn" on:click={handleAddRelay}>Add Relay</button>
          </div>
          
          {#if relayError}
            <p class="error-text">{relayError}</p>
          {/if}
        </div>
      {/if}
    </div>
    
    {#if $isAuthenticated}
      <div class="section card">
        <h3>Account</h3>
        
        <div class="danger-zone">
          <h4>Danger Zone</h4>
          <p>
            Logging out will remove your keys from this device. Make sure you have backed up your private key before logging out.
          </p>
          <button class="btn btn-danger" on:click={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    {/if}
    
    <div class="section card">
      <h3>About</h3>
      <p>
        Nodus is a modern Nostr client that focuses on usability and performance. It uses the Nostr protocol to provide a decentralized social networking experience.
      </p>
      <p>
        <strong>Version:</strong> 1.0.0-beta
      </p>
      <p>
        <strong>Built with:</strong> Svelte, NDK, Dexie
      </p>
    </div>
  </div>
</Layout>

<style>
  .settings-page {
    max-width: 800px;
    margin: 0 auto;
  }
  
  .section {
    margin-bottom: 2rem;
    padding: 1.5rem;
  }
  
  .section h3 {
    margin-top: 0;
    margin-bottom: 1rem;
    color: var(--nodus-blue);
  }
  
  .setting-group {
    margin-bottom: 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
  }
  
  .setting-group:last-child {
    margin-bottom: 0;
  }
  
  .setting-group label {
    font-weight: 600;
    margin-bottom: 0.5rem;
    margin-right: 1rem;
  }
  
  .setting-controls select {
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    background-color: white;
    min-width: 200px;
  }
  
  :global(body.dark) .setting-controls select {
    background-color: #333;
    color: #eee;
    border-color: #555;
  }
  
  .help-text {
    font-size: 0.875rem;
    color: #666;
    margin-bottom: 1.5rem;
  }
  
  :global(body.dark) .help-text {
    color: #aaa;
  }
  
  .relay-list {
    list-style: none;
    padding: 0;
    margin: 0 0 1.5rem 0;
  }
  
  .relay-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    border-bottom: 1px solid #eee;
  }
  
  :global(body.dark) .relay-item {
    border-bottom-color: #333;
  }
  
  .relay-item:last-child {
    border-bottom: none;
  }
  
  .relay-info {
    display: flex;
    flex-direction: column;
  }
  
  .relay-url {
    font-family: monospace;
    margin-bottom: 0.25rem;
  }
  
  .relay-status {
    font-size: 0.75rem;
    color: #f44336;
  }
  
  .relay-status.connected {
    color: #4caf50;
  }
  
  .btn-icon {
    background: none;
    border: none;
    font-size: 1rem;
    cursor: pointer;
    color: #666;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
  }
  
  .btn-icon:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }
  
  :global(body.dark) .btn-icon {
    color: #aaa;
  }
  
  :global(body.dark) .btn-icon:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .relay-form {
    margin-top: 1.5rem;
  }
  
  .input-group {
    display: flex;
  }
  
  .input-group input {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px 0 0 4px;
    font-family: inherit;
  }
  
  :global(body.dark) .input-group input {
    background-color: #333;
    color: #eee;
    border-color: #555;
  }
  
  .input-group .btn {
    border-radius: 0 4px 4px 0;
  }
  
  .error-text {
    color: #f44336;
    font-size: 0.875rem;
    margin-top: 0.5rem;
  }
  
  .danger-zone {
    background-color: #ffebee;
    padding: 1.5rem;
    border-radius: 4px;
    margin-top: 1.5rem;
  }
  
  :global(body.dark) .danger-zone {
    background-color: rgba(244, 67, 54, 0.1);
  }
  
  .danger-zone h4 {
    color: #c62828;
    margin-top: 0;
    margin-bottom: 0.75rem;
  }
  
  .btn-danger {
    background-color: #f44336;
    color: white;
  }
</style>