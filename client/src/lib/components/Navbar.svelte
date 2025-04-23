<script>
  import { Link, useLocation } from 'svelte-routing';
  import { auth } from '../stores/auth';
  import { theme } from '../stores/theme';
  import { onMount } from 'svelte';
  
  // For active route styling
  let location;
  $: currentPath = location ? location.pathname : '/';
  
  // Mobile menu state
  let mobileMenuOpen = false;
  
  // Toggle mobile menu
  function toggleMobileMenu() {
    mobileMenuOpen = !mobileMenuOpen;
  }
  
  // Close mobile menu on navigation
  function handleNavigation() {
    mobileMenuOpen = false;
  }
  
  // Toggle theme
  function toggleTheme() {
    theme.toggle();
  }
  
  // Listen for window resize to close mobile menu on desktop
  onMount(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        mobileMenuOpen = false;
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });
</script>

<nav class="navbar">
  <div class="container mx-auto px-4">
    <div class="navbar-content">
      <!-- Logo -->
      <div class="navbar-logo">
        <Link to="/" on:click={handleNavigation}>
          <span class="logo-text">Nodus</span>
        </Link>
      </div>
      
      <!-- Desktop menu -->
      <div class="navbar-links-desktop">
        <Link to="/" class:active={currentPath === '/'} on:click={handleNavigation}>Home</Link>
        {#if $auth.isAuthenticated}
          <Link to={`/profile/${$auth.user?.pubkey}`} class:active={currentPath.startsWith('/profile')} on:click={handleNavigation}>Profile</Link>
          <Link to="/messages" class:active={currentPath.startsWith('/messages')} on:click={handleNavigation}>Messages</Link>
          <Link to="/settings" class:active={currentPath === '/settings'} on:click={handleNavigation}>Settings</Link>
        {/if}
      </div>
      
      <!-- Right side actions -->
      <div class="navbar-actions">
        <!-- Theme toggle -->
        <button class="theme-toggle" on:click={toggleTheme}>
          {#if $theme === 'dark'}
            ☀️
          {:else}
            🌙
          {/if}
        </button>
        
        <!-- Auth actions -->
        {#if $auth.isAuthenticated}
          <button class="auth-button" on:click={() => auth.logout()}>Logout</button>
        {:else}
          <Link to="/login" class="auth-button">Login</Link>
        {/if}
        
        <!-- Mobile menu toggle -->
        <button class="mobile-menu-toggle" on:click={toggleMobileMenu}>
          {#if mobileMenuOpen}
            ✕
          {:else}
            ☰
          {/if}
        </button>
      </div>
    </div>
    
    <!-- Mobile menu -->
    {#if mobileMenuOpen}
      <div class="navbar-links-mobile" transition:slide={{duration: 200}}>
        <Link to="/" class:active={currentPath === '/'} on:click={handleNavigation}>Home</Link>
        {#if $auth.isAuthenticated}
          <Link to={`/profile/${$auth.user?.pubkey}`} class:active={currentPath.startsWith('/profile')} on:click={handleNavigation}>Profile</Link>
          <Link to="/messages" class:active={currentPath.startsWith('/messages')} on:click={handleNavigation}>Messages</Link>
          <Link to="/settings" class:active={currentPath === '/settings'} on:click={handleNavigation}>Settings</Link>
        {/if}
      </div>
    {/if}
  </div>
</nav>

<style>
  .navbar {
    background-color: white;
    border-bottom: 1px solid #eaeaea;
    position: sticky;
    top: 0;
    z-index: 100;
    transition: background-color 0.3s;
  }
  
  :global(.dark) .navbar {
    background-color: #1a1a1a;
    border-bottom-color: #333;
  }
  
  .navbar-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 64px;
  }
  
  .navbar-logo {
    font-size: 1.5rem;
    font-weight: 700;
  }
  
  .logo-text {
    color: var(--nodus-blue);
    letter-spacing: -0.5px;
  }
  
  .navbar-links-desktop {
    display: none;
  }
  
  @media (min-width: 768px) {
    .navbar-links-desktop {
      display: flex;
      gap: 1.5rem;
    }
  }
  
  .navbar-links-desktop a, .navbar-links-mobile a {
    color: #666;
    text-decoration: none;
    font-weight: 500;
    padding: 0.5rem;
    border-radius: 0.25rem;
  }
  
  :global(.dark) .navbar-links-desktop a, 
  :global(.dark) .navbar-links-mobile a {
    color: #ccc;
  }
  
  .navbar-links-desktop a:hover, .navbar-links-mobile a:hover {
    color: var(--nodus-blue);
    background-color: rgba(20, 92, 232, 0.05);
  }
  
  .navbar-links-desktop a.active, .navbar-links-mobile a.active {
    color: var(--nodus-blue);
    font-weight: 600;
  }
  
  .navbar-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .theme-toggle {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem;
  }
  
  .auth-button {
    background-color: var(--nodus-blue);
    color: white;
    border: none;
    border-radius: 0.25rem;
    padding: 0.5rem 1rem;
    font-weight: 500;
    cursor: pointer;
    text-decoration: none;
    font-size: 0.9rem;
  }
  
  .auth-button:hover {
    background-color: #104bc9;
  }
  
  .mobile-menu-toggle {
    display: block;
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #666;
  }
  
  :global(.dark) .mobile-menu-toggle {
    color: #ccc;
  }
  
  @media (min-width: 768px) {
    .mobile-menu-toggle {
      display: none;
    }
  }
  
  .navbar-links-mobile {
    display: flex;
    flex-direction: column;
    padding: 1rem 0;
    border-top: 1px solid #eaeaea;
  }
  
  :global(.dark) .navbar-links-mobile {
    border-top-color: #333;
  }
  
  .navbar-links-mobile a {
    padding: 0.75rem 0;
  }
</style>