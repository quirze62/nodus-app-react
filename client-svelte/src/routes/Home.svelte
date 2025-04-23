<script>
  import { onMount, onDestroy } from 'svelte';
  import Layout from '../components/Layout.svelte';
  import { loadNotes, notes, isLoading, error, subscribeToNotes } from '../lib/services/nostr-event-service.js';
  import { getProfile, cachedProfiles } from '../lib/services/profile-service.js';
  import { isAuthenticated } from '../lib/stores/auth.js';
  import { format } from 'date-fns';
  
  let unsubscribe = null;
  
  onMount(async () => {
    // Load initial notes
    await loadNotes(30);
    
    // Subscribe to new notes
    unsubscribe = subscribeToNotes(
      (newNote) => {
        // Add the new note to the top of the list
        notes.update(currentNotes => [newNote, ...currentNotes]);
      }
    );
    
    // Pre-fetch profiles for note authors
    fetchProfiles();
  });
  
  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe();
    }
  });
  
  // Function to format a timestamp
  function formatDate(timestamp) {
    if (!timestamp) return '';
    // Convert to milliseconds if needed
    const date = new Date(timestamp * 1000);
    return format(date, 'MMM d, yyyy h:mm a');
  }
  
  // Function to fetch profiles for note authors
  async function fetchProfiles() {
    // Extract unique pubkeys from notes
    const pubkeys = [...new Set($notes.map(note => note.pubkey))];
    
    // Fetch profiles in parallel
    await Promise.all(pubkeys.map(pubkey => getProfile(pubkey)));
  }
  
  // Function to get author name
  function getAuthorName(pubkey) {
    const profiles = $cachedProfiles;
    if (profiles.has(pubkey)) {
      const profile = profiles.get(pubkey);
      return profile.displayName || profile.name || 'Unknown User';
    }
    return 'Unknown User';
  }
  
  // Function to get author picture
  function getAuthorPicture(pubkey) {
    const profiles = $cachedProfiles;
    if (profiles.has(pubkey)) {
      return profiles.get(pubkey).picture || '';
    }
    return '';
  }
</script>

<Layout isLoading={$isLoading} title="Home">
  <div class="home-page">
    {#if $isAuthenticated}
      <div class="post-form card">
        <h3>Share a Note</h3>
        <div class="post-input">
          <textarea placeholder="What's on your mind?"></textarea>
        </div>
        <div class="post-actions">
          <button class="btn">Post</button>
        </div>
      </div>
    {/if}
    
    {#if $error}
      <div class="error-message card">
        <p>{$error}</p>
        <button class="btn" on:click={() => loadNotes()}>Try Again</button>
      </div>
    {/if}
    
    <div class="feed">
      {#if $notes && $notes.length > 0}
        {#each $notes as note}
          <div class="note-card card">
            <div class="note-header">
              <div class="author-avatar">
                {#if getAuthorPicture(note.pubkey)}
                  <img src={getAuthorPicture(note.pubkey)} alt="Avatar" />
                {:else}
                  <div class="avatar-placeholder"></div>
                {/if}
              </div>
              <div class="note-meta">
                <div class="author-name">{getAuthorName(note.pubkey)}</div>
                <div class="note-time">{formatDate(note.created_at)}</div>
              </div>
            </div>
            <div class="note-content">
              <p>{note.content}</p>
            </div>
            <div class="note-actions">
              <button class="action-btn">❤️ Like</button>
              <button class="action-btn">🔄 Repost</button>
              <button class="action-btn">💬 Reply</button>
            </div>
          </div>
        {/each}
        <button class="btn btn-outline load-more" on:click={() => loadNotes(50)}>
          Load More
        </button>
      {:else if !$isLoading}
        <div class="empty-state card">
          <p>No notes found. Check your relay connections or follow some users to see their posts.</p>
        </div>
      {/if}
    </div>
  </div>
</Layout>

<style>
  .home-page {
    max-width: 600px;
    margin: 0 auto;
  }
  
  .post-form {
    margin-bottom: 2rem;
  }
  
  .post-form h3 {
    margin-top: 0;
    margin-bottom: 1rem;
  }
  
  .post-input {
    margin-bottom: 1rem;
  }
  
  .post-input textarea {
    width: 100%;
    min-height: 100px;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    resize: vertical;
    font-family: inherit;
  }
  
  :global(body.dark) .post-input textarea {
    background-color: #333;
    color: #eee;
    border-color: #555;
  }
  
  .post-actions {
    display: flex;
    justify-content: flex-end;
  }
  
  .feed {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .note-card {
    padding: 1.5rem;
  }
  
  .note-header {
    display: flex;
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
  
  .note-meta {
    flex: 1;
  }
  
  .author-name {
    font-weight: 600;
    margin-bottom: 0.25rem;
  }
  
  .note-time {
    font-size: 0.875rem;
    color: #666;
  }
  
  :global(body.dark) .note-time {
    color: #aaa;
  }
  
  .note-content {
    margin-bottom: 1rem;
    word-break: break-word;
  }
  
  .note-content p {
    margin: 0;
    white-space: pre-wrap;
  }
  
  .note-actions {
    display: flex;
    gap: 1rem;
    border-top: 1px solid #eee;
    padding-top: 1rem;
  }
  
  :global(body.dark) .note-actions {
    border-top-color: #333;
  }
  
  .action-btn {
    background: none;
    border: none;
    color: #666;
    cursor: pointer;
    font-size: 0.875rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    transition: background-color 0.2s;
  }
  
  :global(body.dark) .action-btn {
    color: #aaa;
  }
  
  .action-btn:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }
  
  :global(body.dark) .action-btn:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .error-message {
    color: #d32f2f;
    margin-bottom: 1rem;
  }
  
  .empty-state {
    text-align: center;
    padding: 3rem 1.5rem;
    color: #666;
  }
  
  :global(body.dark) .empty-state {
    color: #aaa;
  }
  
  .load-more {
    margin-top: 1rem;
    align-self: center;
  }
  
  .btn-outline {
    background-color: transparent;
    border: 1px solid var(--nodus-blue);
    color: var(--nodus-blue);
  }
  
  .btn-outline:hover {
    background-color: rgba(20, 92, 232, 0.05);
  }
  
  :global(body.dark) .btn-outline:hover {
    background-color: rgba(20, 92, 232, 0.1);
  }
</style>