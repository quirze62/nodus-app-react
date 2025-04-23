<script>
  import { onMount } from 'svelte';
  import { Link } from 'svelte-routing';
  import { theme, setTheme, THEMES } from '../lib/stores/theme.js';
  import { isAuthenticated, user } from '../lib/stores/auth.js';
  
  export let isLoading = false;
  export let title = 'Nodus';
  
  // Function to toggle dark mode
  function toggleDarkMode() {
    if ($theme === THEMES.DARK) {
      setTheme(THEMES.LIGHT);
    } else {
      setTheme(THEMES.DARK);
    }
  }
  
  onMount(() => {
    // Initialize any layout-specific functionality
  });
</script>

<div class="layout">
  <header class="main-header">
    <div class="container">
      <div class="logo">
        <Link to="/">
          <h1>Nodus</h1>
        </Link>
      </div>
      
      <nav class="main-nav">
        <Link to="/">Home</Link>
        {#if $isAuthenticated}
          <Link to="/profile">Profile</Link>
          <Link to="/messages">Messages</Link>
        {/if}
        <Link to="/settings">Settings</Link>
      </nav>
      
      <div class="header-actions">
        <button class="theme-toggle" on:click={toggleDarkMode} title="Toggle dark mode">
          {#if $theme === THEMES.DARK}
            🌙
          {:else}
            ☀️
          {/if}
        </button>
        
        {#if $isAuthenticated}
          <div class="user-pill">
            <Link to="/profile">
              {#if $user && $user.profile && $user.profile.name}
                {$user.profile.name}
              {:else}
                Profile
              {/if}
            </Link>
          </div>
        {:else}
          <Link to="/login" class="btn">Login</Link>
        {/if}
      </div>
    </div>
  </header>
  
  <main class="main-content">
    {#if isLoading}
      <div class="loading-overlay">
        <div class="spinner"></div>
        <p>Loading...</p>
      </div>
    {/if}
    
    <div class="container">
      <h2 class="page-title">{title}</h2>
      <slot></slot>
    </div>
  </main>
  
  <footer class="main-footer">
    <div class="container">
      <p>&copy; 2025 Nodus - A modern Nostr client</p>
      <div class="footer-links">
        <a href="https://github.com/nodus/nodus-app" target="_blank" rel="noopener noreferrer">GitHub</a>
        <a href="https://docs.mynodus.com" target="_blank" rel="noopener noreferrer">Documentation</a>
        <Link to="/about">About</Link>
      </div>
    </div>
  </footer>
</div>

<style>
  .layout {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }
  
  .main-header {
    background-color: var(--nodus-blue);
    color: white;
    padding: 1rem 0;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .main-header .container {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  .logo h1 {
    margin: 0;
    font-size: 1.5rem;
  }
  
  .logo a {
    color: white;
    text-decoration: none;
  }
  
  .main-nav {
    display: flex;
    gap: 1.5rem;
  }
  
  .main-nav a {
    color: white;
    text-decoration: none;
    font-weight: 500;
    position: relative;
  }
  
  .main-nav a:hover {
    text-decoration: underline;
  }
  
  .main-nav a:global(.active) {
    font-weight: 700;
  }
  
  .main-nav a:global(.active)::after {
    content: '';
    position: absolute;
    bottom: -5px;
    left: 0;
    width: 100%;
    height: 2px;
    background-color: white;
  }
  
  .header-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .theme-toggle {
    background: none;
    border: none;
    color: white;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
  }
  
  .user-pill {
    background-color: rgba(255, 255, 255, 0.2);
    border-radius: 20px;
    padding: 0.4rem 1rem;
  }
  
  .user-pill a {
    color: white;
    text-decoration: none;
    font-weight: 500;
  }
  
  .main-content {
    flex: 1;
    padding: 2rem 0;
    position: relative;
  }
  
  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(255, 255, 255, 0.8);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  :global(body.dark) .loading-overlay {
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
  }
  
  .page-title {
    margin-top: 0;
    margin-bottom: 1.5rem;
    font-size: 2rem;
    color: var(--nodus-blue);
  }
  
  .main-footer {
    background-color: #f5f5f5;
    padding: 1.5rem 0;
    font-size: 0.875rem;
  }
  
  :global(body.dark) .main-footer {
    background-color: #222;
    color: #aaa;
  }
  
  .main-footer .container {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .footer-links {
    display: flex;
    gap: 1.5rem;
  }
  
  .footer-links a {
    color: #666;
    text-decoration: none;
  }
  
  :global(body.dark) .footer-links a {
    color: #aaa;
  }
  
  .footer-links a:hover {
    text-decoration: underline;
  }
  
  @media (max-width: 768px) {
    .main-header .container {
      flex-direction: column;
      gap: 1rem;
    }
    
    .main-nav {
      width: 100%;
      justify-content: space-around;
    }
    
    .main-footer .container {
      flex-direction: column;
      gap: 1rem;
      text-align: center;
    }
  }
</style>