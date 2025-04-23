<script>
  import { onMount } from 'svelte';
  import { login, generateNewKeys, isLoading, error } from '../lib/stores/auth.js';
  import Layout from '../components/Layout.svelte';
  import { navigate } from 'svelte-routing';
  
  let privateKey = '';
  let showPrivateKey = false;
  let selectedTab = 'login'; // login or create
  
  // Function to handle login form submission
  async function handleLogin() {
    if (!privateKey) return;
    
    const success = await login(privateKey);
    
    if (success) {
      // Navigate to home
      navigate('/');
    }
  }
  
  // Function to create a new user
  async function handleCreateAccount() {
    try {
      const user = await generateNewKeys();
      
      if (user) {
        privateKey = user.privateKey;
        showPrivateKey = true;
      }
    } catch (err) {
      console.error('Failed to create new keys:', err);
    }
  }
  
  // Function to toggle tabs
  function setTab(tab) {
    selectedTab = tab;
    // Clear form data and error
    privateKey = '';
    showPrivateKey = false;
  }
</script>

<Layout title={selectedTab === 'login' ? 'Login' : 'Create Account'} isLoading={$isLoading}>
  <div class="auth-page">
    <div class="auth-container card">
      <div class="auth-tabs">
        <button 
          class={`tab-btn ${selectedTab === 'login' ? 'active' : ''}`} 
          on:click={() => setTab('login')}
        >
          Login
        </button>
        <button 
          class={`tab-btn ${selectedTab === 'create' ? 'active' : ''}`} 
          on:click={() => setTab('create')}
        >
          Create Account
        </button>
      </div>
      
      {#if $error}
        <div class="error-message">
          <p>{$error}</p>
        </div>
      {/if}
      
      {#if selectedTab === 'login'}
        <div class="auth-form">
          <div class="form-group">
            <label for="privateKey">Private Key (nsec or hex)</label>
            <div class="input-group">
              <input 
                type={showPrivateKey ? 'text' : 'password'} 
                id="privateKey" 
                bind:value={privateKey} 
                placeholder="nsec1..." 
              />
              <button 
                type="button" 
                class="toggle-visibility" 
                on:click={() => showPrivateKey = !showPrivateKey}
              >
                {showPrivateKey ? '🙈' : '👁️'}
              </button>
            </div>
            <p class="help-text">
              Enter your Nostr private key (nsec or hex format).
            </p>
          </div>
          
          <div class="form-actions">
            <button class="btn" on:click={handleLogin} disabled={!privateKey || $isLoading}>
              Login
            </button>
          </div>
        </div>
      {:else}
        <div class="auth-form">
          {#if privateKey}
            <div class="success-message">
              <h3>Account Created Successfully!</h3>
              <p>Your private key is shown below. Please save it in a secure location - it will only be shown once.</p>
              
              <div class="key-display">
                <code>{privateKey}</code>
                <button 
                  class="copy-btn"
                  on:click={() => {
                    navigator.clipboard.writeText(privateKey);
                    alert('Private key copied to clipboard!');
                  }}
                >
                  Copy
                </button>
              </div>
              
              <div class="warning">
                <p>⚠️ IMPORTANT: This key is your identity. Anyone with access to this key can control your account. Keep it safe and never share it!</p>
              </div>
              
              <button class="btn" on:click={() => navigate('/')}>
                Continue to App
              </button>
            </div>
          {:else}
            <p class="info-text">
              Create a new Nostr identity with a unique key pair. Your private key will be generated securely in your browser.
            </p>
            
            <div class="form-actions">
              <button class="btn" on:click={handleCreateAccount} disabled={$isLoading}>
                Generate New Keys
              </button>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</Layout>

<style>
  .auth-page {
    max-width: 500px;
    margin: 0 auto;
  }
  
  .auth-container {
    padding: 2rem;
  }
  
  .auth-tabs {
    display: flex;
    margin-bottom: 2rem;
    border-bottom: 1px solid #eee;
  }
  
  :global(body.dark) .auth-tabs {
    border-bottom-color: #333;
  }
  
  .tab-btn {
    background: none;
    border: none;
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 500;
    color: #666;
    cursor: pointer;
    position: relative;
  }
  
  :global(body.dark) .tab-btn {
    color: #aaa;
  }
  
  .tab-btn.active {
    color: var(--nodus-blue);
    font-weight: 600;
  }
  
  .tab-btn.active::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    width: 100%;
    height: 2px;
    background-color: var(--nodus-blue);
  }
  
  .auth-form {
    padding: 1rem 0;
  }
  
  .form-group {
    margin-bottom: 1.5rem;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
  }
  
  .input-group {
    display: flex;
    position: relative;
  }
  
  .input-group input {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-family: inherit;
    font-size: 1rem;
    padding-right: 3rem;
  }
  
  :global(body.dark) .input-group input {
    background-color: #333;
    color: #eee;
    border-color: #555;
  }
  
  .toggle-visibility {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .help-text {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: #666;
  }
  
  :global(body.dark) .help-text {
    color: #aaa;
  }
  
  .info-text {
    margin-bottom: 2rem;
  }
  
  .form-actions {
    margin-top: 2rem;
  }
  
  .error-message {
    background-color: #ffebee;
    color: #d32f2f;
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1.5rem;
  }
  
  :global(body.dark) .error-message {
    background-color: rgba(211, 47, 47, 0.2);
  }
  
  .error-message p {
    margin: 0;
  }
  
  .success-message {
    text-align: center;
  }
  
  .success-message h3 {
    color: #2e7d32;
    margin-top: 0;
  }
  
  .key-display {
    background-color: #f5f5f5;
    padding: 1rem;
    border-radius: 4px;
    margin: 1.5rem 0;
    position: relative;
    word-break: break-all;
    font-family: monospace;
  }
  
  :global(body.dark) .key-display {
    background-color: #333;
  }
  
  .copy-btn {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background-color: var(--nodus-blue);
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    cursor: pointer;
    font-size: 0.75rem;
  }
  
  .warning {
    background-color: #fff8e1;
    color: #ff8f00;
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1.5rem;
    text-align: left;
  }
  
  :global(body.dark) .warning {
    background-color: rgba(255, 143, 0, 0.2);
  }
  
  .warning p {
    margin: 0;
  }
</style>