<script>
  import { onMount } from 'svelte';
  import { Router, Route, Link } from 'svelte-routing';
  import Home from './routes/Home.svelte';
  import Login from './routes/Login.svelte';
  import Profile from './routes/Profile.svelte';
  import Messages from './routes/Messages.svelte';
  import Settings from './routes/Settings.svelte';
  import { theme } from './lib/stores/theme';
  import { user } from './lib/stores/auth';

  let isAuthenticated = false;

  // Subscribe to auth changes
  user.subscribe(value => {
    isAuthenticated = !!value;
  });

  onMount(() => {
    // Apply theme on initial load
    const currentTheme = localStorage.getItem('nodus-theme') || 'system';
    if (currentTheme === 'dark' || 
        (currentTheme === 'system' && 
         window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.body.classList.add('dark');
    }
  });
</script>

<Router>
  <div class="app">
    {#if isAuthenticated}
      <nav>
        <div class="container nav-content">
          <div class="logo">
            <span>Nodus</span>
          </div>
          <div class="nav-links">
            <Link to="/">Home</Link>
            <Link to="/messages">Messages</Link>
            <Link to="/profile">Profile</Link>
            <Link to="/settings">Settings</Link>
          </div>
        </div>
      </nav>
      
      <main class="container">
        <Route path="/" component={Home} />
        <Route path="/messages" component={Messages} />
        <Route path="/profile" component={Profile} />
        <Route path="/settings" component={Settings} />
      </main>
    {:else}
      <Route path="*" component={Login} />
    {/if}
  </div>
</Router>

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