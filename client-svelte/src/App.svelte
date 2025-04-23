<script>
  import { Router, Route } from 'svelte-routing';
  import { onMount } from 'svelte';
  import { initializeNDK } from './lib/services/ndk-config.js';
  
  // Routes
  import Home from './routes/Home.svelte';
  import Profile from './routes/Profile.svelte';
  import Messages from './routes/messages/index.svelte';
  import Conversation from './routes/messages/[pubkey].svelte';
  import Login from './routes/Login.svelte';
  import Settings from './routes/Settings.svelte';
  
  export let url = '';
  
  onMount(async () => {
    // Initialize Nostr client
    console.info('[INFO] Initializing Nostr client with NDK');
    await initializeNDK();
  });
</script>

<Router {url}>
  <div>
    <Route path="/" component={Home} />
    <Route path="/profile" component={Profile} />
    <Route path="/messages" component={Messages} />
    <Route path="/messages/:pubkey" let:params>
      <Conversation pubkey={params.pubkey} />
    </Route>
    <Route path="/login" component={Login} />
    <Route path="/settings" component={Settings} />
  </div>
</Router>

<style>
  :global(html, body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  }
  
  :global(*, *::before, *::after) {
    box-sizing: border-box;
  }
  
  :global(:root) {
    --nodus-blue: #145ce8;
  }
</style>