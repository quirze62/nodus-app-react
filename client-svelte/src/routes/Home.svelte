<script>
  import { onMount } from 'svelte';
  import { navigate } from 'svelte-routing';
  import Layout from '../components/Layout.svelte';
  import { loadNotes, events, isLoading, error } from '../lib/services/nostr-event-service.js';
  import { getProfile, cachedProfiles } from '../lib/services/profile-service.js';
  import { isAuthenticated, user } from '../lib/stores/auth.js';
  import { formatDistanceToNow } from 'date-fns';
  
  // State for new post
  let newPostContent = '';
  let isPostingNote = false;
  let postError = '';
  
  // Function to load the timeline
  async function loadTimeline() {
    try {
      await loadNotes(50);
    } catch (err) {
      console.error('[ERROR] Failed to load timeline:', err);
    }
  }
  
  // Function to format date
  function formatDate(timestamp) {
    if (!timestamp) return '';
    
    // Convert from seconds to milliseconds if needed
    const date = new Date(timestamp * 1000);
    
    return formatDistanceToNow(date, { addSuffix: true });
  }
  
  // Function to get profile for a note
  async function getProfileForNote(pubkey) {
    if (!pubkey) return;
    
    try {
      await getProfile(pubkey);
    } catch (err) {
      console.error('[ERROR] Failed to get profile:', err);
    }
  }
  
  // Load the timeline on mount
  onMount(async () => {
    await loadTimeline();
    
    // For each note, load the author's profile
    for (const note of $events) {
      getProfileForNote(note.pubkey);
    }
  });
  
  // Function to get author name
  function getAuthorName(pubkey) {
    if (!pubkey) return 'Unknown';
    
    const profiles = $cachedProfiles;
    if (profiles.has(pubkey)) {
      const profile = profiles.get(pubkey);
      return profile.displayName || profile.name || 'Unknown User';
    }
    
    // Start loading profile if not already in cache
    getProfileForNote(pubkey);
    
    return 'Unknown User';
  }
  
  // Function to get author picture
  function getAuthorPicture(pubkey) {
    if (!pubkey) return '';
    
    const profiles = $cachedProfiles;
    if (profiles.has(pubkey)) {
      return profiles.get(pubkey).picture || '';
    }
    
    return '';
  }
  
  // Function to format pubkey
  function formatPubkey(pubkey) {
    if (!pubkey) return '';
    return `${pubkey.substring(0, 6)}...${pubkey.substring(pubkey.length - 6)}`;
  }
</script>

<Layout title="Home" isLoading={$isLoading}>
  <div class="timeline">
    {#if $isAuthenticated}
      <div class="compose-container card">
        <div class="compose-header">
          <h3>What's on your mind?</h3>
        </div>
        
        <div class="compose-body">
          <textarea 
            bind:value={newPostContent} 
            placeholder="Share something with the Nostr community..."
            rows="3"
          ></textarea>
        </div>
        
        {#if postError}
          <div class="error-message">
            <p>{postError}</p>
          </div>
        {/if}
        
        <div class="compose-footer">
          <button 
            class="btn post-btn" 
            disabled={!newPostContent.trim() || isPostingNote}
          >
            {isPostingNote ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>
    {/if}
    
    {#if $error}
      <div class="error-message card">
        <p>{$error}</p>
        <button class="btn" on:click={loadTimeline}>Retry</button>
      </div>
    {/if}
    
    {#if !$isLoading && $events.length === 0}
      <div class="empty-timeline card">
        <h3>No posts to show</h3>
        <p>When you connect to relays and follow users, their posts will appear here.</p>
        
        {#if !$isAuthenticated}
          <button class="btn" on:click={() => navigate('/login')}>
            Login to Nodus
          </button>
        {/if}
      </div>
    {/if}
    
    <div class="posts-list">
      {#each $events as note}
        <div class="post-item card">
          <div class="post-header">
            <div class="author-avatar">
              {#if getAuthorPicture(note.pubkey)}
                <img src={getAuthorPicture(note.pubkey)} alt="Avatar" />
              {:else}
                <div class="avatar-placeholder"></div>
              {/if}
            </div>
            
            <div class="author-info">
              <div class="author-name">{getAuthorName(note.pubkey)}</div>
              <div class="author-pubkey">{formatPubkey(note.pubkey)}</div>
            </div>
            
            <div class="post-time">
              {formatDate(note.created_at)}
            </div>
          </div>
          
          <div class="post-content">
            {note.content}
          </div>
          
          <div class="post-actions">
            <button class="action-btn">
              <span class="action-icon">💬</span>
              <span class="action-label">Reply</span>
            </button>
            
            <button class="action-btn">
              <span class="action-icon">🔄</span>
              <span class="action-label">Repost</span>
            </button>
            
            <button class="action-btn">
              <span class="action-icon">❤️</span>
              <span class="action-label">Like</span>
            </button>
          </div>
        </div>
      {/each}
    </div>
  </div>
</Layout>

<style>
  .timeline {
    max-width: 600px;
    margin: 0 auto;
  }
  
  .compose-container {
    margin-bottom: 2rem;
  }
  
  .compose-header {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #eee;
  }
  
  :global(body.dark) .compose-header {
    border-bottom-color: #333;
  }
  
  .compose-header h3 {
    margin: 0;
    font-size: 1.25rem;
  }
  
  .compose-body {
    padding: 1.5rem;
  }
  
  .compose-body textarea {
    width: 100%;
    padding: 1rem;
    border: 1px solid #eee;
    border-radius: 0.5rem;
    font-family: inherit;
    font-size: 1rem;
    resize: vertical;
    background-color: transparent;
  }
  
  :global(body.dark) .compose-body textarea {
    border-color: #333;
    color: #eee;
  }
  
  .compose-footer {
    padding: 0 1.5rem 1.5rem;
    display: flex;
    justify-content: flex-end;
  }
  
  .post-btn {
    padding: 0.5rem 2rem;
  }
  
  .error-message {
    margin: 1rem 1.5rem;
    padding: 1rem;
    background-color: #ffebee;
    color: #d32f2f;
    border-radius: 0.5rem;
  }
  
  :global(body.dark) .error-message {
    background-color: rgba(211, 47, 47, 0.2);
  }
  
  .empty-timeline {
    text-align: center;
    padding: 3rem 2rem;
  }
  
  .empty-timeline h3 {
    margin-top: 0;
    color: var(--nodus-blue);
  }
  
  .empty-timeline p {
    margin-bottom: 2rem;
    color: #666;
  }
  
  :global(body.dark) .empty-timeline p {
    color: #aaa;
  }
  
  .posts-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .post-item {
    padding: 1.5rem;
  }
  
  .post-header {
    display: flex;
    align-items: center;
    margin-bottom: 1rem;
  }
  
  .author-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    overflow: hidden;
    margin-right: 1rem;
    background-color: #eee;
  }
  
  :global(body.dark) .author-avatar {
    background-color: #444;
  }
  
  .author-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .avatar-placeholder {
    width: 100%;
    height: 100%;
    background-color: var(--nodus-blue);
  }
  
  .author-info {
    flex: 1;
  }
  
  .author-name {
    font-weight: 600;
    margin-bottom: 0.25rem;
  }
  
  .author-pubkey {
    font-size: 0.75rem;
    color: #666;
    font-family: monospace;
  }
  
  :global(body.dark) .author-pubkey {
    color: #aaa;
  }
  
  .post-time {
    font-size: 0.75rem;
    color: #666;
  }
  
  :global(body.dark) .post-time {
    color: #aaa;
  }
  
  .post-content {
    margin-bottom: 1.5rem;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }
  
  .post-actions {
    display: flex;
    gap: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid #eee;
  }
  
  :global(body.dark) .post-actions {
    border-top-color: #333;
  }
  
  .action-btn {
    background: none;
    border: none;
    display: flex;
    align-items: center;
    color: #666;
    font-size: 0.875rem;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 9999px;
    transition: background-color 0.2s;
  }
  
  :global(body.dark) .action-btn {
    color: #aaa;
  }
  
  .action-btn:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }
  
  :global(body.dark) .action-btn:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }
  
  .action-icon {
    font-size: 1rem;
    margin-right: 0.5rem;
  }
  
  @media (max-width: 768px) {
    .timeline {
      max-width: 100%;
    }
    
    .post-item, .compose-container {
      border-radius: 0;
      margin-left: -1rem;
      margin-right: -1rem;
    }
    
    .action-label {
      display: none;
    }
    
    .action-icon {
      font-size: 1.25rem;
      margin-right: 0;
    }
    
    .post-actions {
      justify-content: space-around;
    }
  }
</style>