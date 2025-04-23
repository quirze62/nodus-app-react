<script>
  import { onMount } from 'svelte';
  import { user } from '../lib/stores/auth.js';
  import { navigate } from 'svelte-routing';
  
  let nsecInput = '';
  let isLoading = false;
  let errorMessage = '';
  
  async function handlePrivateKeyLogin() {
    if (!nsecInput.trim()) {
      errorMessage = 'Please enter your private key';
      return;
    }
    
    isLoading = true;
    errorMessage = '';
    
    try {
      const success = await user.loginWithPrivateKey(nsecInput);
      if (success) {
        navigate('/');
      } else {
        errorMessage = 'Login failed. Please check your private key.';
      }
    } catch (error) {
      console.error('Login error:', error);
      errorMessage = 'An error occurred during login.';
    } finally {
      isLoading = false;
    }
  }
  
  async function handleExtensionLogin() {
    isLoading = true;
    errorMessage = '';
    
    try {
      const success = await user.loginWithExtension();
      if (success) {
        navigate('/');
      } else {
        errorMessage = 'Extension login failed. Make sure your Nostr extension is installed and configured.';
      }
    } catch (error) {
      console.error('Extension login error:', error);
      errorMessage = 'An error occurred during extension login.';
    } finally {
      isLoading = false;
    }
  }
  
  async function handleGenerateKeys() {
    isLoading = true;
    errorMessage = '';
    
    try {
      await user.generateNewKeys();
      navigate('/');
    } catch (error) {
      console.error('Key generation error:', error);
      errorMessage = 'Failed to generate new keys.';
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="login-container">
  <div class="login-card">
    <div class="logo">
      <h1>Nodus</h1>
      <p>A private Nostr community</p>
    </div>
    
    <div class="login-form">
      <h2>Login to your account</h2>
      
      {#if errorMessage}
        <div class="error-message">
          {errorMessage}
        </div>
      {/if}
      
      <div class="input-group">
        <label for="nsec">Private Key (nsec)</label>
        <input 
          type="password" 
          id="nsec" 
          bind:value={nsecInput} 
          placeholder="Enter your nsec..." 
          disabled={isLoading}
        />
      </div>
      
      <button 
        class="login-button" 
        on:click={handlePrivateKeyLogin} 
        disabled={isLoading}
      >
        {isLoading ? 'Logging in...' : 'Login with Private Key'}
      </button>
      
      <div class="separator">
        <span>OR</span>
      </div>
      
      <button 
        class="extension-button" 
        on:click={handleExtensionLogin} 
        disabled={isLoading}
      >
        {isLoading ? 'Connecting...' : 'Login with Extension'}
      </button>
      
      <div class="separator">
        <span>OR</span>
      </div>
      
      <button 
        class="generate-button" 
        on:click={handleGenerateKeys} 
        disabled={isLoading}
      >
        {isLoading ? 'Generating...' : 'Generate New Keys'}
      </button>
      
      <p class="privacy-note">
        Your private keys never leave your device. We value your privacy.
      </p>
    </div>
  </div>
</div>

<style>
  .login-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    padding: 20px;
    background-color: var(--bg-light);
  }
  
  :global(body.dark) .login-container {
    background-color: var(--bg-dark);
  }
  
  .login-card {
    width: 100%;
    max-width: 500px;
    padding: 40px;
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
    background-color: white;
  }
  
  :global(body.dark) .login-card {
    background-color: var(--bg-dark);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  }
  
  .logo {
    text-align: center;
    margin-bottom: 32px;
  }
  
  .logo h1 {
    font-size: 42px;
    font-weight: 700;
    color: var(--primary-color);
    margin-bottom: 8px;
  }
  
  .logo p {
    font-size: 16px;
    color: #666;
  }
  
  :global(body.dark) .logo p {
    color: #aaa;
  }
  
  .login-form h2 {
    font-size: 24px;
    margin-bottom: 24px;
    text-align: center;
  }
  
  .input-group {
    margin-bottom: 20px;
  }
  
  .input-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
  }
  
  .input-group input {
    width: 100%;
    padding: 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 16px;
    transition: border-color 0.3s;
  }
  
  :global(body.dark) .input-group input {
    border-color: #444;
    background-color: #222;
    color: white;
  }
  
  .input-group input:focus {
    border-color: var(--primary-color);
    outline: none;
  }
  
  button {
    width: 100%;
    padding: 12px;
    border: none;
    border-radius: 6px;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.3s;
  }
  
  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .login-button {
    background-color: var(--primary-color);
    color: white;
  }
  
  .extension-button {
    background-color: #333;
    color: white;
  }
  
  .generate-button {
    background-color: #28a745;
    color: white;
  }
  
  .separator {
    display: flex;
    align-items: center;
    text-align: center;
    margin: 20px 0;
  }
  
  .separator::before,
  .separator::after {
    content: '';
    flex: 1;
    border-bottom: 1px solid #ddd;
  }
  
  :global(body.dark) .separator::before,
  :global(body.dark) .separator::after {
    border-bottom: 1px solid #444;
  }
  
  .separator span {
    padding: 0 10px;
    color: #666;
  }
  
  :global(body.dark) .separator span {
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
  
  .privacy-note {
    margin-top: 20px;
    text-align: center;
    font-size: 14px;
    color: #666;
  }
  
  :global(body.dark) .privacy-note {
    color: #aaa;
  }
</style>