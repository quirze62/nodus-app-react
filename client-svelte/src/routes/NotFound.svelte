<script>
  import { Link } from 'svelte-routing';
</script>

<div class="not-found">
  <div class="content">
    <h1>404</h1>
    <h2>Page Not Found</h2>
    <p>The page you're looking for doesn't exist or has been moved.</p>
    <Link to="/" class="home-link">Go Home</Link>
  </div>
</div>

<style>
  .not-found {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 70vh;
    text-align: center;
    padding: 0 1rem;
  }
  
  .content {
    max-width: 500px;
  }
  
  h1 {
    font-size: 6rem;
    font-weight: 700;
    color: var(--nodus-blue);
    margin: 0;
    line-height: 1;
  }
  
  h2 {
    font-size: 2rem;
    font-weight: 600;
    margin: 0.5rem 0 1.5rem;
  }
  
  p {
    font-size: 1.1rem;
    color: #666;
    margin-bottom: 2rem;
  }
  
  :global(.dark) p {
    color: #aaa;
  }
  
  .home-link {
    display: inline-block;
    background-color: var(--nodus-blue);
    color: white;
    text-decoration: none;
    padding: 0.75rem 2rem;
    border-radius: 9999px;
    font-weight: 600;
    transition: background-color 0.2s;
  }
  
  .home-link:hover {
    background-color: #0d47a1;
    text-decoration: none;
  }
</style>