<script>
  import { onMount } from 'svelte';
  import { user } from '../lib/stores/auth.js';
  
  let currentUser;
  let notes = [];
  let isLoading = true;
  let errorMessage = '';
  let newNoteContent = '';
  
  // Subscribe to user changes
  const unsubscribe = user.subscribe(value => {
    currentUser = value;
  });
  
  onMount(async () => {
    try {
      // Simulate loading notes
      setTimeout(() => {
        notes = [
          {
            id: '1',
            pubkey: 'test-pubkey',
            content: 'Welcome to Nodus, a private Nostr community!',
            created_at: new Date().getTime() / 1000 - 3600
          },
          {
            id: '2',
            pubkey: 'test-pubkey',
            content: 'This is a sample note. The real app will connect to Nostr relays.',
            created_at: new Date().getTime() / 1000 - 1800
          }
        ];
        isLoading = false;
      }, 1000);
    } catch (error) {
      console.error('Error loading notes:', error);
      errorMessage = 'Failed to load notes. Please try again later.';
      isLoading = false;
    }
  });
  
  function formatTime(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  async function handlePostNote() {
    if (!newNoteContent.trim()) return;
    
    try {
      // In a real implementation, this would publish to relays
      const newNote = {
        id: Date.now().toString(),
        pubkey: currentUser.pubkey,
        content: newNoteContent,
        created_at: Math.floor(Date.now() / 1000)
      };
      
      notes = [newNote, ...notes];
      newNoteContent = '';
    } catch (error) {
      console.error('Error posting note:', error);
      errorMessage = 'Failed to post your note. Please try again.';
    }
  }
</script>

<div class="home-container">
  <h1>Home Feed</h1>
  
  {#if errorMessage}
    <div class="error-message">
      {errorMessage}
    </div>
  {/if}
  
  <div class="compose-note">
    <textarea
      placeholder="What's on your mind?"
      bind:value={newNoteContent}
      rows="3"
    ></textarea>
    <button on:click={handlePostNote}>Post</button>
  </div>
  
  <div class="notes-list">
    {#if isLoading}
      <div class="loading">
        <p>Loading notes...</p>
      </div>
    {:else if notes.length === 0}
      <div class="empty-state">
        <p>No notes to display. Be the first to post!</p>
      </div>
    {:else}
      {#each notes as note}
        <div class="note-card">
          <div class="note-header">
            <div class="user-info">
              <div class="avatar"></div>
              <div class="user-name">
                {note.pubkey === currentUser?.pubkey ? 'You' : 'User ' + note.pubkey.slice(0, 8)}
              </div>
            </div>
            <div class="note-time">
              {formatTime(note.created_at)}
            </div>
          </div>
          <div class="note-content">
            {note.content}
          </div>
          <div class="note-actions">
            <button class="action-button">Like</button>
            <button class="action-button">Repost</button>
            <button class="action-button">Reply</button>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .home-container {
    max-width: 600px;
    margin: 0 auto;
  }
  
  h1 {
    margin-bottom: 20px;
    font-size: 24px;
    font-weight: 600;
  }
  
  .error-message {
    background-color: #ffeeee;
    color: #d32f2f;
    padding: 12px;
    border-radius: 6px;
    margin-bottom: 20px;
    border-left: 4px solid #d32f2f;
  }
  
  :global(body.dark) .error-message {
    background-color: rgba(211, 47, 47, 0.2);
    color: #ff6b6b;
  }
  
  .compose-note {
    background-color: white;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
  }
  
  :global(body.dark) .compose-note {
    background-color: var(--bg-dark);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  
  textarea {
    width: 100%;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 12px;
    font-family: inherit;
    font-size: 16px;
    resize: vertical;
  }
  
  :global(body.dark) textarea {
    border-color: #444;
    background-color: #222;
    color: white;
  }
  
  textarea:focus {
    outline: none;
    border-color: var(--primary-color);
  }
  
  .compose-note button {
    align-self: flex-end;
    width: auto;
    padding: 8px 24px;
    background-color: var(--primary-color);
    color: white;
    border: none;
    border-radius: 20px;
    font-weight: 500;
    cursor: pointer;
  }
  
  .loading, .empty-state {
    text-align: center;
    padding: 40px 0;
    color: #666;
  }
  
  :global(body.dark) .loading,
  :global(body.dark) .empty-state {
    color: #aaa;
  }
  
  .note-card {
    background-color: white;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  :global(body.dark) .note-card {
    background-color: var(--bg-dark);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  
  .note-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  
  .user-info {
    display: flex;
    align-items: center;
  }
  
  .avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background-color: var(--primary-color);
    margin-right: 12px;
  }
  
  .user-name {
    font-weight: 600;
  }
  
  .note-time {
    color: #666;
    font-size: 14px;
  }
  
  :global(body.dark) .note-time {
    color: #aaa;
  }
  
  .note-content {
    margin-bottom: 16px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }
  
  .note-actions {
    display: flex;
    gap: 12px;
  }
  
  .action-button {
    background: none;
    border: none;
    color: #666;
    font-size: 14px;
    padding: 4px 8px;
    cursor: pointer;
    border-radius: 4px;
  }
  
  :global(body.dark) .action-button {
    color: #aaa;
  }
  
  .action-button:hover {
    background-color: #f5f5f5;
    color: var(--primary-color);
  }
  
  :global(body.dark) .action-button:hover {
    background-color: #333;
  }
</style>