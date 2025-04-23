<script>
  import { onMount } from 'svelte';
  import { Router, Route } from 'svelte-routing';
  import { NDKSvelteProvider } from '@nostr-dev-kit/ndk-svelte';
  import { ndkConfig } from './lib/services/ndk-config';
  import { theme } from './lib/stores/theme';
  
  // Components
  import Navbar from './lib/components/Navbar.svelte';
  import Toast from './lib/components/Toast.svelte';
  
  // Routes
  import Home from './routes/Home.svelte';
  import Profile from './routes/Profile.svelte';
  import Messages from './routes/Messages.svelte';
  import Settings from './routes/Settings.svelte';
  import NotFound from './routes/NotFound.svelte';
  
  let appTheme;
  
  // Subscribe to theme changes
  theme.subscribe(value => {
    appTheme = value;
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', value === 'dark');
    }
  });
  
  onMount(() => {
    // Check system preference for dark mode
    if (typeof window !== 'undefined' && window.matchMedia) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        theme.set('dark');
      }
    }
  });
</script>

<NDKSvelteProvider {ndkConfig}>
  <div class="app {appTheme}">
    <Navbar />
    
    <main class="container mx-auto px-4 py-8">
      <Router>
        <Route path="/" component={Home} />
        <Route path="/profile/:pubkey?" component={Profile} />
        <Route path="/messages/:pubkey?" component={Messages} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Router>
    </main>
    
    <Toast />
  </div>
</NDKSvelteProvider>

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
    background-color: #f7f7f7;
    color: #333;
    transition: background-color 0.3s, color 0.3s;
  }
  
  :global(.dark) {
    background-color: #121212;
    color: #e0e0e0;
  }
  
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  
  main {
    flex: 1;
  }
</style>