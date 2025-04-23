<script>
  import { onMount } from 'svelte';
  import { Router, Route, Link } from 'svelte-routing';
  import { NDKSvelte } from '@nostr-dev-kit/ndk-svelte';
  import { auth } from './lib/stores/auth';
  import { theme } from './lib/stores/theme';
  import { toast } from './lib/stores/toast';
  import { initNDK } from './lib/services/ndk-config';
  
  // Route components
  import Home from './routes/Home.svelte';
  import Profile from './routes/Profile.svelte';
  import Messages from './routes/Messages.svelte';
  import Settings from './routes/Settings.svelte';
  
  // Determine if on mobile
  let isMobile = false;
  let menuOpen = false;
  
  // Check if we're on a mobile device
  function checkMobile() {
    isMobile = window.innerWidth < 768;
  }
  
  // Toggle menu for mobile
  function toggleMenu() {
    menuOpen = !menuOpen;
  }
  
  // Apply the current theme
  $: if ($theme) {
    if ($theme === 'dark' || ($theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }
  
  // Initialize NDK on mount
  onMount(() => {
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    // Initialize NDK
    initNDK();
    
    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = () => {
      if ($theme === 'system') {
        if (mediaQuery.matches) {
          document.body.classList.add('dark');
        } else {
          document.body.classList.remove('dark');
        }
      }
    };
    
    mediaQuery.addEventListener('change', handleThemeChange);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      mediaQuery.removeEventListener('change', handleThemeChange);
    };
  });
</script>

<NDKSvelte>
  <Router>
    <div class="app">
      <!-- Header -->
      <header class="header">
        <div class="header-container">
          <div class="header-left">
            <div class="logo">
              <Link to="/">
                <img src="/nodus-icon.svg" alt="Nodus" width="32" height="32" />
                <span class="logo-text">Nodus</span>
              </Link>
            </div>
          </div>
          
          <div class="header-right">
            {#if $auth.isAuthenticated}
              <div class="user-info">
                <Link to={`/profile/${$auth.user?.pubkey}`} class="profile-link">
                  {#if $auth.user?.profile?.picture}
                    <img src={$auth.user.profile.picture} alt="Profile" class="profile-image" />
                  {:else}
                    <div class="profile-placeholder">
                      {$auth.user?.profile?.name?.[0]?.toUpperCase() || '?'}
                    </div>
                  {/if}
                </Link>
              </div>
            {/if}
            
            <!-- Mobile menu toggle -->
            {#if isMobile}
              <button class="menu-toggle" on:click={toggleMenu}>
                <span class="menu-icon"></span>
              </button>
            {/if}
          </div>
        </div>
      </header>
      
      <!-- Main content area -->
      <div class="main-container">
        <!-- Sidebar (desktop) or overlay menu (mobile) -->
        <div class="sidebar {isMobile ? 'mobile' : ''} {menuOpen ? 'open' : ''}">
          <nav class="nav">
            <ul class="nav-list">
              <li class="nav-item">
                <Link to="/" on:click={() => isMobile && toggleMenu()}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                  <span>Home</span>
                </Link>
              </li>
              {#if $auth.isAuthenticated}
                <li class="nav-item">
                  <Link to={`/profile/${$auth.user?.pubkey}`} on:click={() => isMobile && toggleMenu()}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon"><circle cx="12" cy="8" r="5"></circle><path d="M20 21a8 8 0 1 0-16 0"></path></svg>
                    <span>Profile</span>
                  </Link>
                </li>
                <li class="nav-item">
                  <Link to="/messages" on:click={() => isMobile && toggleMenu()}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                    <span>Messages</span>
                  </Link>
                </li>
                <li class="nav-item">
                  <Link to="/settings" on:click={() => isMobile && toggleMenu()}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    <span>Settings</span>
                  </Link>
                </li>
                <li class="nav-item">
                  <button class="nav-button" on:click={() => { auth.logout(); isMobile && toggleMenu(); }}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    <span>Logout</span>
                  </button>
                </li>
              {/if}
            </ul>
          </nav>
          
          {#if isMobile}
            <div class="overlay" on:click={toggleMenu}></div>
          {/if}
        </div>
        
        <!-- Content area -->
        <main class="content">
          <Route path="/" component={Home} />
          <Route path="/profile/:pubkey" component={Profile} />
          <Route path="/messages" component={Messages} />
          <Route path="/messages/:pubkey" component={Messages} />
          <Route path="/settings" component={Settings} />
        </main>
      </div>
      
      <!-- Toast container -->
      {#if $toast.length > 0}
        <div class="toast-container">
          {#each $toast as message (message.id)}
            <div class="toast toast-{message.type}" transition:fade>
              {message.text}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </Router>
</NDKSvelte>

<style>
  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }
  
  .header {
    height: 64px;
    border-bottom: 1px solid var(--border);
    background-color: var(--card-bg);
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 10;
  }
  
  .header-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 100%;
    padding: 0 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
  }
  
  .logo {
    display: flex;
    align-items: center;
  }
  
  .logo a {
    display: flex;
    align-items: center;
    text-decoration: none;
    color: var(--foreground);
  }
  
  .logo img {
    width: 32px;
    height: 32px;
    margin-right: 0.75rem;
  }
  
  .logo-text {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--nodus-blue);
  }
  
  .header-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .user-info {
    display: flex;
    align-items: center;
  }
  
  .profile-link {
    display: flex;
    align-items: center;
    text-decoration: none;
  }
  
  .profile-image {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
  }
  
  .profile-placeholder {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background-color: var(--nodus-blue);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
  }
  
  .menu-toggle {
    width: 32px;
    height: 32px;
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  
  .menu-icon {
    width: 24px;
    height: 2px;
    background-color: var(--foreground);
    position: relative;
    transition: all 0.3s ease;
  }
  
  .menu-icon::before,
  .menu-icon::after {
    content: '';
    position: absolute;
    width: 24px;
    height: 2px;
    background-color: var(--foreground);
    transition: all 0.3s ease;
  }
  
  .menu-icon::before {
    transform: translateY(-8px);
  }
  
  .menu-icon::after {
    transform: translateY(8px);
  }
  
  .open .menu-icon {
    background-color: transparent;
  }
  
  .open .menu-icon::before {
    transform: rotate(45deg);
  }
  
  .open .menu-icon::after {
    transform: rotate(-45deg);
  }
  
  .main-container {
    display: flex;
    flex: 1;
    margin-top: 64px;
  }
  
  .sidebar {
    width: 240px;
    flex-shrink: 0;
    background-color: var(--card-bg);
    border-right: 1px solid var(--border);
    height: calc(100vh - 64px);
    position: sticky;
    top: 64px;
    overflow-y: auto;
  }
  
  .sidebar.mobile {
    position: fixed;
    top: 64px;
    left: 0;
    z-index: 20;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
  }
  
  .sidebar.mobile.open {
    transform: translateX(0);
  }
  
  .overlay {
    position: fixed;
    top: 64px;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 10;
    display: none;
  }
  
  .sidebar.mobile.open .overlay {
    display: block;
  }
  
  .nav {
    padding: 1.5rem 0;
  }
  
  .nav-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .nav-item {
    margin-bottom: 0.5rem;
  }
  
  .nav-item a,
  .nav-button {
    display: flex;
    align-items: center;
    padding: 0.75rem 1.5rem;
    text-decoration: none;
    color: var(--foreground);
    font-weight: 500;
    transition: background-color 0.2s;
    border: none;
    background: none;
    width: 100%;
    text-align: left;
    cursor: pointer;
    font-size: 1rem;
  }
  
  .nav-item a:hover,
  .nav-button:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }
  
  .dark .nav-item a:hover,
  .dark .nav-button:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .nav-icon {
    width: 20px;
    height: 20px;
    margin-right: 0.75rem;
  }
  
  .content {
    flex: 1;
    padding: 1.5rem;
    overflow-y: auto;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
  }
  
  @media (max-width: 767px) {
    .content {
      padding: 1rem;
    }
  }
</style>