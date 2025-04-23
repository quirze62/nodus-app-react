<script>
  import { onMount } from 'svelte';
  import { navigate } from 'svelte-routing';
  import { isAuthenticated } from '../lib/stores/auth.js';
  import { theme } from '../lib/stores/theme.js';
  
  // Props
  export let title = 'Nodus';
  export let isLoading = false;
  export let showNavbar = true;
  
  // Active navigation item
  let activeItem = '';
  
  onMount(() => {
    // Determine active navigation item based on URL
    const path = window.location.pathname;
    
    if (path === '/') {
      activeItem = 'home';
    } else if (path.startsWith('/messages')) {
      activeItem = 'messages';
    } else if (path.startsWith('/profile')) {
      activeItem = 'profile';
    } else if (path.startsWith('/settings')) {
      activeItem = 'settings';
    }
  });
</script>

<div class="app-container">
  <header class="app-header">
    <div class="logo" on:click={() => navigate('/')}>
      <span class="logo-text">nodus</span>
    </div>
    
    <div class="header-right">
      {#if $isAuthenticated}
        <button class="compose-btn" on:click={() => navigate('/compose')}>
          <span class="compose-icon">+</span>
          <span class="compose-text">New Post</span>
        </button>
      {/if}
    </div>
  </header>
  
  <main class="main-content">
    {#if showNavbar}
      <nav class="sidebar">
        <ul class="nav-list">
          <li class="nav-item" class:active={activeItem === 'home'}>
            <a href="/" on:click|preventDefault={() => navigate('/')}>
              <span class="nav-icon">🏠</span>
              <span class="nav-text">Home</span>
            </a>
          </li>
          
          {#if $isAuthenticated}
            <li class="nav-item" class:active={activeItem === 'profile'}>
              <a href="/profile" on:click|preventDefault={() => navigate('/profile')}>
                <span class="nav-icon">👤</span>
                <span class="nav-text">Profile</span>
              </a>
            </li>
            
            <li class="nav-item" class:active={activeItem === 'messages'}>
              <a href="/messages" on:click|preventDefault={() => navigate('/messages')}>
                <span class="nav-icon">✉️</span>
                <span class="nav-text">Messages</span>
              </a>
            </li>
            
            <li class="nav-item" class:active={activeItem === 'settings'}>
              <a href="/settings" on:click|preventDefault={() => navigate('/settings')}>
                <span class="nav-icon">⚙️</span>
                <span class="nav-text">Settings</span>
              </a>
            </li>
          {/if}
          
          {#if !$isAuthenticated}
            <li class="nav-item" class:active={activeItem === 'login'}>
              <a href="/login" on:click|preventDefault={() => navigate('/login')}>
                <span class="nav-icon">🔑</span>
                <span class="nav-text">Login</span>
              </a>
            </li>
          {/if}
        </ul>
      </nav>
    {/if}
    
    <div class="content">
      <div class="content-header">
        <h1 class="page-title">{title}</h1>
      </div>
      
      {#if isLoading}
        <div class="loading-indicator">
          <div class="spinner"></div>
          <p>Loading...</p>
        </div>
      {:else}
        <div class="content-body">
          <slot></slot>
        </div>
      {/if}
    </div>
  </main>
</div>

<style>
  .app-container {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background-color: #f5f5f5;
  }
  
  :global(body.dark) .app-container {
    background-color: #111;
    color: #eee;
  }
  
  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 2rem;
    background-color: white;
    border-bottom: 1px solid #eee;
    position: sticky;
    top: 0;
    z-index: 100;
  }
  
  :global(body.dark) .app-header {
    background-color: #1a1a1a;
    border-bottom-color: #333;
  }
  
  .logo {
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--nodus-blue);
    cursor: pointer;
    user-select: none;
  }
  
  .compose-btn {
    background-color: var(--nodus-blue);
    color: white;
    border: none;
    border-radius: 24px;
    padding: 0.5rem 1.25rem;
    font-size: 1rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .compose-btn:hover {
    background-color: #0e47b8;
  }
  
  .compose-icon {
    font-size: 1.25rem;
    margin-right: 0.5rem;
  }
  
  .main-content {
    display: flex;
    flex: 1;
  }
  
  .sidebar {
    width: 250px;
    padding: 2rem 1rem 1rem 2rem;
    border-right: 1px solid #eee;
  }
  
  :global(body.dark) .sidebar {
    border-right-color: #333;
  }
  
  .nav-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .nav-item {
    margin-bottom: 1rem;
  }
  
  .nav-item a {
    display: flex;
    align-items: center;
    padding: 0.75rem 1rem;
    border-radius: 1.5rem;
    text-decoration: none;
    color: #333;
    transition: background-color 0.2s;
  }
  
  :global(body.dark) .nav-item a {
    color: #eee;
  }
  
  .nav-item a:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }
  
  :global(body.dark) .nav-item a:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }
  
  .nav-item.active a {
    font-weight: 600;
    color: var(--nodus-blue);
  }
  
  .nav-icon {
    margin-right: 1rem;
    font-size: 1.25rem;
    width: 1.5rem;
    text-align: center;
  }
  
  .content {
    flex: 1;
    padding: 2rem;
    min-width: 0;
  }
  
  .content-header {
    margin-bottom: 2rem;
  }
  
  .page-title {
    margin: 0;
    font-size: 1.75rem;
    color: var(--nodus-blue);
  }
  
  .loading-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(0, 0, 0, 0.1);
    border-left-color: var(--nodus-blue);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }
  
  :global(body.dark) .spinner {
    border-color: rgba(255, 255, 255, 0.1);
    border-left-color: var(--nodus-blue);
  }
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  
  /* Card styling for consistent UI */
  :global(.card) {
    background-color: white;
    border-radius: 0.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }
  
  :global(body.dark) :global(.card) {
    background-color: #1a1a1a;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
  
  /* Button styling for consistent UI */
  :global(.btn) {
    background-color: var(--nodus-blue);
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  :global(.btn:hover) {
    background-color: #0e47b8;
  }
  
  :global(.btn:disabled) {
    background-color: #ccc;
    cursor: not-allowed;
  }
  
  :global(body.dark) :global(.btn:disabled) {
    background-color: #555;
  }
  
  /* Responsive adjustments */
  @media (max-width: 768px) {
    .app-header {
      padding: 1rem;
    }
    
    .main-content {
      flex-direction: column;
    }
    
    .sidebar {
      width: 100%;
      padding: 1rem;
      border-right: none;
      border-bottom: 1px solid #eee;
    }
    
    :global(body.dark) .sidebar {
      border-bottom-color: #333;
    }
    
    .nav-list {
      display: flex;
      justify-content: space-between;
    }
    
    .nav-item {
      margin-bottom: 0;
    }
    
    .nav-text {
      display: none;
    }
    
    .nav-icon {
      margin-right: 0;
    }
    
    .content {
      padding: 1rem;
    }
    
    .compose-text {
      display: none;
    }
    
    .compose-btn {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      padding: 0;
      justify-content: center;
    }
    
    .compose-icon {
      margin-right: 0;
    }
  }
</style>