<script>
  import { onMount } from 'svelte';
  import { useNDK } from '@nostr-dev-kit/ndk-svelte';
  import { auth } from '../lib/stores/auth';
  import { theme } from '../lib/stores/theme';
  import { toast } from '../lib/stores/toast';
  import { relayStore, addRelay, removeRelay, syncRelays } from '../lib/services/relay-service';
  import { db } from '../lib/db/db';
  
  // Local state
  let isAddingRelay = false;
  let newRelayUrl = '';
  let relays = [];
  let isLoadingRelays = true;
  let showDeleteAccountModal = false;
  
  // Subscribe to relay store
  const unsubscribe = relayStore.subscribe(state => {
    relays = state.relays;
    isLoadingRelays = state.isLoading;
  });
  
  // Theme options
  const themeOptions = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' }
  ];
  
  // Handle theme change
  function handleThemeChange(e) {
    theme.set(e.target.value);
  }
  
  // Handle add relay
  async function handleAddRelay() {
    if (!newRelayUrl.trim()) return;
    
    isAddingRelay = true;
    
    try {
      const success = await addRelay(newRelayUrl);
      
      if (success) {
        newRelayUrl = '';
        await relayStore.refresh();
      }
    } catch (error) {
      console.error('Error adding relay:', error);
      toast.error('Failed to add relay');
    } finally {
      isAddingRelay = false;
    }
  }
  
  // Handle remove relay
  async function handleRemoveRelay(url) {
    try {
      await removeRelay(url);
      await relayStore.refresh();
    } catch (error) {
      console.error('Error removing relay:', error);
      toast.error('Failed to remove relay');
    }
  }
  
  // Handle check relay connection
  async function handleCheckConnection(url) {
    try {
      await relayStore.checkConnection(url);
    } catch (error) {
      console.error('Error checking relay connection:', error);
      toast.error('Failed to check relay connection');
    }
  }
  
  // Handle clear local data
  async function handleClearLocalData() {
    try {
      await db.events.clear();
      await db.profiles.clear();
      
      toast.success('Local data cleared successfully');
    } catch (error) {
      console.error('Error clearing local data:', error);
      toast.error('Failed to clear local data');
    }
  }
  
  // Export private key
  function handleExportPrivateKey() {
    if (!$auth.isAuthenticated || !$auth.user) {
      toast.error('You must be logged in to export your private key');
      return;
    }
    
    try {
      // Show warning
      if (!confirm('WARNING: Your private key is a secret that controls your Nostr identity. Never share it with anyone. Are you sure you want to view it?')) {
        return;
      }
      
      const privateKey = $auth.user.privateKey;
      
      // Show the key in another confirm dialog so it can be copied
      alert(`Your private key (KEEP IT SECRET):\n\n${privateKey}`);
    } catch (error) {
      console.error('Error exporting private key:', error);
      toast.error('Failed to export private key');
    }
  }
  
  // Toggle delete account modal
  function toggleDeleteAccountModal() {
    showDeleteAccountModal = !showDeleteAccountModal;
  }
  
  // Handle delete account
  async function handleDeleteAccount() {
    try {
      // Clear local data
      await db.events.clear();
      await db.profiles.clear();
      await db.session.clear();
      await db.settings.clear();
      
      // Log out
      await auth.logout();
      
      // Redirect to home
      window.location.href = '/';
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Failed to delete account');
    } finally {
      showDeleteAccountModal = false;
    }
  }
  
  // Load data on mount
  onMount(async () => {
    // Sync and refresh relays
    await syncRelays();
    await relayStore.refresh();
  });
  
  // Cleanup on destroy
  onDestroy(() => {
    unsubscribe();
  });
</script>

<div class="settings-page">
  <h1>Settings</h1>
  
  {#if !$auth.isAuthenticated}
    <div class="auth-required">
      <h2>Authentication Required</h2>
      <p>You need to be logged in to access settings.</p>
      <a href="/" class="back-link">Back to Home</a>
    </div>
  {:else}
    <div class="settings-container">
      <!-- Theme Settings -->
      <section class="settings-section">
        <h2>Appearance</h2>
        
        <div class="settings-option">
          <label for="theme">Theme</label>
          <select id="theme" value={$theme} on:change={handleThemeChange}>
            {#each themeOptions as option}
              <option value={option.value}>
                {option.label}
              </option>
            {/each}
          </select>
        </div>
      </section>
      
      <!-- Relay Settings -->
      <section class="settings-section">
        <h2>Relay Management</h2>
        <p class="section-description">
          Relays are servers that store and forward Nostr events.
          Add or remove relays to control where your data is sent and received.
        </p>
        
        <div class="relay-add">
          <input 
            type="text"
            placeholder="wss://relay.example.com"
            bind:value={newRelayUrl}
          />
          <button 
            class="add-relay-btn"
            on:click={handleAddRelay}
            disabled={!newRelayUrl.trim() || isAddingRelay}
          >
            {isAddingRelay ? 'Adding...' : 'Add Relay'}
          </button>
        </div>
        
        <div class="relay-list">
          {#if isLoadingRelays}
            <div class="loading-relays">
              <div class="spinner small"></div>
              <p>Loading relays...</p>
            </div>
          {:else if relays.length === 0}
            <div class="empty-relays">
              <p>No relays configured.</p>
            </div>
          {:else}
            {#each relays as relay (relay.url)}
              <div class="relay-item">
                <div class="relay-info">
                  <div class="relay-url">{relay.url}</div>
                  <div class="relay-status {relay.connected ? 'connected' : 'disconnected'}">
                    {relay.connected ? 'Connected' : 'Disconnected'}
                  </div>
                </div>
                
                <div class="relay-actions">
                  <button 
                    class="check-btn"
                    on:click={() => handleCheckConnection(relay.url)}
                    disabled={relay.checking}
                  >
                    {relay.checking ? '...' : 'Check'}
                  </button>
                  
                  <button 
                    class="remove-btn"
                    on:click={() => handleRemoveRelay(relay.url)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </section>
      
      <!-- Data Management -->
      <section class="settings-section">
        <h2>Data Management</h2>
        
        <div class="settings-option">
          <div class="option-description">
            <p><strong>Clear Local Data</strong></p>
            <p class="help-text">
              This will clear all cached data from your browser, including posts and profiles.
              Your account and settings will remain intact.
            </p>
          </div>
          
          <button class="danger-btn" on:click={handleClearLocalData}>
            Clear Data
          </button>
        </div>
      </section>
      
      <!-- Account Management -->
      <section class="settings-section">
        <h2>Account Management</h2>
        
        <div class="settings-option">
          <div class="option-description">
            <p><strong>Export Private Key</strong></p>
            <p class="help-text">
              Export your private key for backup or use in other Nostr clients.
              Keep this key secret – anyone with it can control your account.
            </p>
          </div>
          
          <button class="warning-btn" on:click={handleExportPrivateKey}>
            Export Key
          </button>
        </div>
        
        <div class="settings-option">
          <div class="option-description">
            <p><strong>Delete Account</strong></p>
            <p class="help-text">
              This will remove your account data from this device.
              Note: Due to Nostr's decentralized nature, your published
              data may still exist on relays.
            </p>
          </div>
          
          <button class="danger-btn" on:click={toggleDeleteAccountModal}>
            Delete Account
          </button>
        </div>
      </section>
    </div>
    
    <!-- Delete Account Modal -->
    {#if showDeleteAccountModal}
      <div class="modal-backdrop" on:click={toggleDeleteAccountModal}>
        <div class="modal-content" on:click|stopPropagation>
          <h2>Delete Account</h2>
          
          <p>Are you sure you want to delete your account?</p>
          
          <p class="warning-text">
            This will remove your account data from this device. However, due to
            Nostr's decentralized nature, your published content may still exist on relays.
          </p>
          
          <div class="modal-actions">
            <button class="cancel-btn" on:click={toggleDeleteAccountModal}>
              Cancel
            </button>
            
            <button class="danger-btn" on:click={handleDeleteAccount}>
              Delete Account
            </button>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .settings-page {
    max-width: 800px;
    margin: 0 auto;
    padding: 1rem;
  }
  
  h1 {
    font-size: 1.8rem;
    font-weight: 700;
    margin-bottom: 2rem;
    color: var(--nodus-blue);
  }
  
  .auth-required {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 50vh;
    text-align: center;
  }
  
  .auth-required h2 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
  }
  
  .auth-required p {
    color: #666;
    margin-bottom: 1.5rem;
  }
  
  :global(.dark) .auth-required p {
    color: #aaa;
  }
  
  .back-link {
    display: inline-block;
    background-color: var(--nodus-blue);
    color: white;
    text-decoration: none;
    padding: 0.5rem 1.5rem;
    border-radius: 9999px;
    font-weight: 600;
  }
  
  .settings-container {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }
  
  .settings-section {
    background-color: white;
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  :global(.dark) .settings-section {
    background-color: #1e1e1e;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
  
  .settings-section h2 {
    font-size: 1.2rem;
    font-weight: 600;
    margin: 0 0 1rem;
    color: var(--nodus-blue);
  }
  
  .section-description {
    font-size: 0.95rem;
    color: #666;
    margin-bottom: 1.5rem;
  }
  
  :global(.dark) .section-description {
    color: #aaa;
  }
  
  .settings-option {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 0;
    border-bottom: 1px solid #eee;
  }
  
  :global(.dark) .settings-option {
    border-bottom-color: #333;
  }
  
  .settings-option:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
  
  .option-description {
    flex: 1;
  }
  
  .help-text {
    font-size: 0.9rem;
    color: #666;
    margin-top: 0.5rem;
  }
  
  :global(.dark) .help-text {
    color: #aaa;
  }
  
  label {
    font-weight: 500;
    display: block;
    margin-bottom: 0.5rem;
  }
  
  select, input {
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.95rem;
    width: 200px;
  }
  
  :global(.dark) select,
  :global(.dark) input {
    background-color: #333;
    border-color: #444;
    color: #eee;
  }
  
  .relay-add {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }
  
  .relay-add input {
    flex: 1;
  }
  
  .add-relay-btn {
    background-color: var(--nodus-blue);
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0 1.25rem;
    font-weight: 500;
    cursor: pointer;
  }
  
  .add-relay-btn:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
  
  :global(.dark) .add-relay-btn:disabled {
    background-color: #555;
  }
  
  .relay-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .loading-relays, .empty-relays {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem 0;
    text-align: center;
    color: #666;
  }
  
  :global(.dark) .loading-relays,
  :global(.dark) .empty-relays {
    color: #aaa;
  }
  
  .spinner {
    width: 36px;
    height: 36px;
    border: 3px solid rgba(0, 0, 0, 0.1);
    border-radius: 50%;
    border-top-color: var(--nodus-blue);
    animation: spin 1s ease-in-out infinite;
    margin-bottom: 1rem;
  }
  
  .spinner.small {
    width: 24px;
    height: 24px;
    border-width: 2px;
    margin-bottom: 0.5rem;
  }
  
  :global(.dark) .spinner {
    border-color: rgba(255, 255, 255, 0.1);
    border-top-color: var(--nodus-blue);
  }
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  
  .relay-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background-color: #f9f9f9;
    border-radius: 4px;
  }
  
  :global(.dark) .relay-item {
    background-color: #2a2a2a;
  }
  
  .relay-info {
    display: flex;
    flex-direction: column;
  }
  
  .relay-url {
    font-weight: 500;
    font-family: monospace;
    margin-bottom: 0.25rem;
    font-size: 0.9rem;
  }
  
  .relay-status {
    font-size: 0.8rem;
    display: flex;
    align-items: center;
  }
  
  .relay-status::before {
    content: "";
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 0.5rem;
  }
  
  .relay-status.connected {
    color: #4CAF50;
  }
  
  .relay-status.connected::before {
    background-color: #4CAF50;
  }
  
  .relay-status.disconnected {
    color: #F44336;
  }
  
  .relay-status.disconnected::before {
    background-color: #F44336;
  }
  
  .relay-actions {
    display: flex;
    gap: 0.5rem;
  }
  
  .check-btn, .remove-btn {
    padding: 0.35rem 0.75rem;
    border-radius: 4px;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
  }
  
  .check-btn {
    background-color: transparent;
    border: 1px solid #ddd;
    color: #666;
  }
  
  :global(.dark) .check-btn {
    border-color: #444;
    color: #aaa;
  }
  
  .remove-btn {
    background-color: #ffebee;
    border: 1px solid #ffcdd2;
    color: #e53935;
  }
  
  :global(.dark) .remove-btn {
    background-color: rgba(229, 57, 53, 0.2);
    border-color: rgba(229, 57, 53, 0.3);
  }
  
  .danger-btn, .warning-btn {
    padding: 0.5rem 1.25rem;
    border-radius: 4px;
    font-weight: 500;
    cursor: pointer;
    border: none;
  }
  
  .danger-btn {
    background-color: #F44336;
    color: white;
  }
  
  .warning-btn {
    background-color: #FF9800;
    color: white;
  }
  
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }
  
  .modal-content {
    background-color: white;
    border-radius: 8px;
    padding: 2rem;
    width: 100%;
    max-width: 500px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
  
  :global(.dark) .modal-content {
    background-color: #1e1e1e;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  
  .modal-content h2 {
    font-size: 1.5rem;
    margin: 0 0 1.5rem;
    color: #F44336;
  }
  
  .warning-text {
    padding: 1rem;
    background-color: #ffebee;
    border-radius: 4px;
    margin: 1.5rem 0;
    color: #c62828;
  }
  
  :global(.dark) .warning-text {
    background-color: rgba(244, 67, 54, 0.2);
    color: #ef5350;
  }
  
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 2rem;
  }
  
  .cancel-btn {
    padding: 0.5rem 1.25rem;
    background-color: transparent;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-weight: 500;
    cursor: pointer;
  }
  
  :global(.dark) .cancel-btn {
    border-color: #444;
    color: #eee;
  }
</style>