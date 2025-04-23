<script>
  import { onMount } from 'svelte';
  import page from 'page';
  import Home from './routes/Home.svelte';
  import Login from './routes/Login.svelte';
  import Profile from './routes/Profile.svelte';
  import Messages from './routes/Messages.svelte';
  import Settings from './routes/Settings.svelte';
  import NotFound from './routes/NotFound.svelte';
  import { theme } from './lib/stores/theme';
  import { user } from './lib/stores/auth';

  let isAuthenticated = false;
  let currentComponent;
  let params = {};

  // Subscribe to auth changes
  user.subscribe(value => {
    isAuthenticated = !!value;
  });

  // Set up page.js routing
  onMount(() => {
    // Apply theme on initial load
    const currentTheme = localStorage.getItem('nodus-theme') || 'system';
    if (currentTheme === 'dark' || 
        (currentTheme === 'system' && 
         window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.body.classList.add('dark');
    }

    // Authentication middleware
    function checkAuth(ctx, next) {
      if (!isAuthenticated) {
        page.redirect('/login');
      } else {
        next();
      }
    }

    // Route definitions
    page('/login', () => {
      if (isAuthenticated) {
        page.redirect('/');
      } else {
        currentComponent = Login;
      }
    });
    page('/', checkAuth, () => currentComponent = Home);
    page('/messages', checkAuth, () => currentComponent = Messages);
    page('/profile', checkAuth, () => currentComponent = Profile);
    page('/settings', checkAuth, () => currentComponent = Settings);
    page('*', () => currentComponent = NotFound);

    // Initialize page.js
    page.start();

    // Cleanup
    return () => page.stop();
  });

  // Navigation helper for templates
  function navigate(path) {
    page(path);
  }
</script>

<div class="app">
  {#if isAuthenticated}
    <nav>
      <div class="container nav-content">
        <div class="logo">
          <span>Nodus</span>
        </div>
        <div class="nav-links">
          <a href="/" on:click|preventDefault={() => navigate('/')}>Home</a>
          <a href="/messages" on:click|preventDefault={() => navigate('/messages')}>Messages</a>
          <a href="/profile" on:click|preventDefault={() => navigate('/profile')}>Profile</a>
          <a href="/settings" on:click|preventDefault={() => navigate('/settings')}>Settings</a>
        </div>
      </div>
    </nav>
    
    <main class="container">
      <svelte:component this={currentComponent} {params} />
    </main>
  {:else}
    <svelte:component this={currentComponent || Login} {params} />
  {/if}
</div>

<style>
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  
  nav {
    background-color: var(--primary-color);
    color: white;
    padding: 12px 0;
  }
  
  .nav-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .logo {
    font-size: 24px;
    font-weight: bold;
  }
  
  .nav-links {
    display: flex;
    gap: 24px;
  }
  
  .nav-links :global(a) {
    color: white;
    text-decoration: none;
    transition: opacity 0.2s;
  }
  
  .nav-links :global(a:hover) {
    opacity: 0.8;
  }
  
  main {
    flex: 1;
    padding: 24px 0;
  }
</style>