<script>
  import { onMount } from 'svelte';

  onMount(() => {
    console.log('NotFound component mounted');
  });
</script>

<div class="not-found">
  <h1>404 - Page Not Found</h1>
  <p>The page you are looking for does not exist.</p>
  <a href="/" class="back-link">Back to Home</a>
</div>

<style>
  .not-found {
    text-align: center;
    padding: 40px 0;
    max-width: 600px;
    margin: 0 auto;
  }

  h1 {
    font-size: 32px;
    color: var(--primary-color);
    margin-bottom: 16px;
  }

  p {
    font-size: 18px;
    color: #666;
    margin-bottom: 24px;
  }

  :global(body.dark) p {
    color: #aaa;
  }

  .back-link {
    display: inline-block;
    padding: 10px 20px;
    background-color: var(--primary-color);
    color: white;
    text-decoration: none;
    border-radius: 6px;
    font-weight: 500;
    transition: opacity 0.2s;
  }

  .back-link:hover {
    opacity: 0.9;
  }
</style>