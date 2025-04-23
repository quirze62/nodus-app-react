<script>
  import { onMount } from 'svelte';
  
  let isLoading = true;
  let error = null;
  
  onMount(() => {
    // Simulate loading
    setTimeout(() => {
      isLoading = false;
    }, 1000);
  });
</script>

<div class="home-page">
  <div class="container">
    <div class="hero card">
      <h1>Welcome to Nodus</h1>
      <p>A modern Nostr client for decentralized social networking</p>
      
      <div class="cta-buttons">
        <button class="btn btn-primary">Create Account</button>
        <button class="btn btn-secondary">Login</button>
      </div>
    </div>
    
    {#if isLoading}
      <div class="loading">
        <div class="spinner"></div>
        <p>Loading feed...</p>
      </div>
    {:else}
      <div class="feed">
        <div class="card">
          <div class="post-header">
            <div class="avatar"></div>
            <div class="post-meta">
              <div class="author-name">Nodus Team</div>
              <div class="post-time">April 23, 2025</div>
            </div>
          </div>
          <div class="post-content">
            <p>Welcome to Nodus! This is a modern Nostr client built with Svelte and NDK.</p>
          </div>
          <div class="post-actions">
            <button class="action-btn">Like</button>
            <button class="action-btn">Repost</button>
            <button class="action-btn">Reply</button>
          </div>
        </div>
        
        <div class="card">
          <div class="post-header">
            <div class="avatar"></div>
            <div class="post-meta">
              <div class="author-name">Nostr User</div>
              <div class="post-time">April 22, 2025</div>
            </div>
          </div>
          <div class="post-content">
            <p>Nostr is a decentralized social network based on cryptographic key pairs.</p>
          </div>
          <div class="post-actions">
            <button class="action-btn">Like</button>
            <button class="action-btn">Repost</button>
            <button class="action-btn">Reply</button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .home-page {
    padding: 2rem 0;
  }
  
  .hero {
    text-align: center;
    padding: 3rem 2rem;
    margin-bottom: 2rem;
  }
  
  .hero h1 {
    color: var(--nodus-blue);
    font-size: 2.5rem;
    margin-bottom: 1rem;
  }
  
  .hero p {
    font-size: 1.25rem;
    margin-bottom: 2rem;
    color: #666;
  }
  
  :global(body.dark) .hero p {
    color: #aaa;
  }
  
  .cta-buttons {
    display: flex;
    gap: 1rem;
    justify-content: center;
  }
  
  .loading {
    text-align: center;
    padding: 3rem 0;
    color: #666;
  }
  
  :global(body.dark) .loading {
    color: #aaa;
  }
  
  .feed {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .post-header {
    display: flex;
    align-items: center;
    margin-bottom: 1rem;
  }
  
  .avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background-color: var(--nodus-blue);
    margin-right: 1rem;
  }
  
  .post-meta {
    display: flex;
    flex-direction: column;
  }
  
  .author-name {
    font-weight: 600;
  }
  
  .post-time {
    font-size: 0.875rem;
    color: #666;
  }
  
  :global(body.dark) .post-time {
    color: #aaa;
  }
  
  .post-content {
    margin-bottom: 1rem;
  }
  
  .post-actions {
    display: flex;
    gap: 1rem;
    border-top: 1px solid #eee;
    padding-top: 1rem;
  }
  
  :global(body.dark) .post-actions {
    border-top-color: #333;
  }
  
  .action-btn {
    background: none;
    border: none;
    color: #666;
    cursor: pointer;
    font-size: 0.875rem;
    padding: 0.25rem 0.5rem;
  }
  
  :global(body.dark) .action-btn {
    color: #aaa;
  }
  
  .action-btn:hover {
    color: var(--nodus-blue);
  }
  
  .btn-primary {
    background-color: var(--nodus-blue);
    color: white;
  }
  
  .btn-secondary {
    background-color: transparent;
    border: 1px solid var(--nodus-blue);
    color: var(--nodus-blue);
  }
</style>