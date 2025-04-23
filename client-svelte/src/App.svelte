<script>
  import { Router, Route, Link } from 'svelte-routing';
  
  // Route components
  import Home from './routes/Home.svelte';
  
  export let url = '';
</script>

<Router {url}>
  <div class="app">
    <header>
      <nav>
        <Link to="/">Home</Link>
      </nav>
    </header>
    
    <main>
      <Route path="/" component={Home} />
    </main>
    
    <footer>
      <p>&copy; 2025 Nodus - A modern Nostr client</p>
    </footer>
  </div>
</Router>

<style>
  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }
  
  header {
    background-color: #145ce8;
    color: white;
    padding: 1rem;
  }
  
  header a {
    color: white;
    text-decoration: none;
    font-weight: bold;
  }
  
  main {
    flex: 1;
    padding: 1rem;
  }
  
  footer {
    background-color: #f5f5f5;
    padding: 1rem;
    text-align: center;
    font-size: 0.875rem;
    color: #666;
  }
  
  :global(body.dark) footer {
    background-color: #222;
    color: #aaa;
  }
</style>