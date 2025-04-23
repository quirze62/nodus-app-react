<script>
  import { onMount, onDestroy } from 'svelte';
  import { auth } from '../lib/stores/auth';
  import { toast } from '../lib/stores/toast';
  import { 
    loadNotes, 
    postNote, 
    createReaction, 
    getReactions, 
    getReposts, 
    getReplies, 
    repostNote, 
    replyToNote,
    subscribeToNotes
  } from '../lib/services/nostr-event-service';
  import { fetchProfile } from '../lib/services/profile-service';
  
  // Local state
  let notes = [];
  let newNoteContent = '';
  let isLoading = true;
  let isPosting = false;
  let activeNote = null;
  let expandedNotes = new Set();
  let subscribeCleanup = null;
  
  // Login state
  let isShowingLogin = false;
  let privateKey = '';
  let isLoggingIn = false;
  
  // Handle login with private key
  async function handleLogin() {
    if (!privateKey.trim()) return;
    
    isLoggingIn = true;
    
    try {
      const success = await auth.login(privateKey);
      
      if (success) {
        privateKey = '';
        isShowingLogin = false;
      } else {
        toast.error('Login failed. Please check your private key.');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Login failed: ' + (error.message || 'Unknown error'));
    } finally {
      isLoggingIn = false;
    }
  }
  
  // Handle "Create new account" action
  async function handleCreateAccount() {
    try {
      const user = await auth.generateNewKeys();
      
      toast.success('New account created successfully!');
      toast.info('Important: Save your private key somewhere safe!');
      
      // Show a modal with the private key
      alert(`Your private key (KEEP IT SECRET):\n\n${user.privateKey}`);
    } catch (error) {
      console.error('Error creating account:', error);
      toast.error('Error creating account: ' + (error.message || 'Unknown error'));
    }
  }
  
  // Post a new note
  async function handlePostNote() {
    if (!newNoteContent.trim() || isPosting) return;
    
    isPosting = true;
    
    try {
      const note = await postNote(newNoteContent);
      
      if (note) {
        // Add to top of notes
        notes = [note, ...notes];
        newNoteContent = '';
        toast.success('Note posted successfully!');
      }
    } catch (error) {
      console.error('Error posting note:', error);
      toast.error('Failed to post note: ' + (error.message || 'Unknown error'));
    } finally {
      isPosting = false;
    }
  }
  
  // Handle like/react to note
  async function handleReact(noteId) {
    if (!$auth.isAuthenticated) {
      isShowingLogin = true;
      return;
    }
    
    try {
      await createReaction(noteId, '+');
      toast.success('Reaction added!');
    } catch (error) {
      console.error('Error reacting to note:', error);
      toast.error('Failed to react: ' + (error.message || 'Unknown error'));
    }
  }
  
  // Handle repost
  async function handleRepost(noteId, notePubkey) {
    if (!$auth.isAuthenticated) {
      isShowingLogin = true;
      return;
    }
    
    try {
      await repostNote(noteId, notePubkey);
      toast.success('Note reposted!');
    } catch (error) {
      console.error('Error reposting note:', error);
      toast.error('Failed to repost: ' + (error.message || 'Unknown error'));
    }
  }
  
  // Toggle note expansion
  function toggleNoteExpansion(noteId) {
    if (expandedNotes.has(noteId)) {
      expandedNotes.delete(noteId);
    } else {
      expandedNotes.add(noteId);
    }
    
    // Trigger reactivity
    expandedNotes = new Set(expandedNotes);
  }
  
  // Format date
  function formatDate(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  }
  
  // Load notes on mount
  onMount(async () => {
    try {
      // Load initial notes
      const loadedNotes = await loadNotes(50);
      notes = loadedNotes || [];
      
      // Subscribe to new notes
      subscribeCleanup = subscribeToNotes(
        (event) => {
          // Check if note already exists to avoid duplicates
          if (!notes.some(note => note.id === event.id)) {
            notes = [event, ...notes];
          }
        }
      );
      
      // Load author profiles
      loadProfiles();
    } catch (error) {
      console.error('Error loading notes:', error);
      toast.error('Failed to load notes');
    } finally {
      isLoading = false;
    }
  });
  
  // Load profiles for note authors
  async function loadProfiles() {
    const authors = [...new Set(notes.map(note => note.pubkey))];
    
    for (const pubkey of authors) {
      try {
        await fetchProfile(pubkey);
      } catch (error) {
        console.error(`Error loading profile for ${pubkey}:`, error);
      }
    }
  }
  
  // Clean up subscription on destroy
  onDestroy(() => {
    if (subscribeCleanup) {
      subscribeCleanup();
    }
  });
</script>

<div class="home-page">
  <div class="container">
    <!-- Login/Signup prompt for non-authenticated users -->
    {#if !$auth.isAuthenticated}
      <div class="auth-banner">
        <h2>Welcome to Nodus</h2>
        <p>A decentralized social network based on the Nostr protocol</p>
        
        <div class="auth-actions">
          <button class="btn btn-primary" on:click={() => isShowingLogin = true}>
            Login
          </button>
          
          <button class="btn btn-secondary" on:click={handleCreateAccount}>
            Create Account
          </button>
        </div>
      </div>
    {/if}
    
    <!-- New note form (for authenticated users) -->
    {#if $auth.isAuthenticated}
      <div class="new-note-form card">
        <textarea 
          placeholder="What's on your mind?"
          bind:value={newNoteContent}
          rows="3"
          class="form-textarea"
        ></textarea>
        
        <div class="form-actions">
          <button 
            class="btn btn-primary"
            on:click={handlePostNote}
            disabled={!newNoteContent.trim() || isPosting}
          >
            {isPosting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>
    {/if}
    
    <!-- Notes feed -->
    <div class="notes-feed">
      {#if isLoading}
        <div class="loading-container">
          <div class="spinner"></div>
          <p>Loading notes...</p>
        </div>
      {:else if notes.length === 0}
        <div class="empty-notes">
          <p>No notes found.</p>
          <p class="help-text">
            {#if $auth.isAuthenticated}
              Be the first to post something!
            {:else}
              Login to start posting.
            {/if}
          </p>
        </div>
      {:else}
        {#each notes as note (note.id)}
          <div class="note-card card">
            <div class="note-header">
              <div class="author-info">
                <a href={`/profile/${note.pubkey}`} class="author-link">
                  <div class="avatar">
                    <!-- Profile image would be fetched from profile data -->
                    <div class="avatar-placeholder">
                      {note.pubkey.substring(0, 2)}
                    </div>
                  </div>
                  
                  <div class="author-meta">
                    <span class="author-name">
                      {note.pubkey.substring(0, 8)}...
                    </span>
                    <span class="note-time">
                      {formatDate(note.created_at)}
                    </span>
                  </div>
                </a>
              </div>
            </div>
            
            <div class="note-content {expandedNotes.has(note.id) ? 'expanded' : ''}">
              <p>{note.content}</p>
              
              {#if note.content.length > 280 && !expandedNotes.has(note.id)}
                <button 
                  class="read-more-btn"
                  on:click={() => toggleNoteExpansion(note.id)}
                >
                  Read more
                </button>
              {/if}
            </div>
            
            <div class="note-actions">
              <button 
                class="action-btn" 
                on:click={() => handleReact(note.id)}
                title="Like"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="action-icon"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                <span>Like</span>
              </button>
              
              <button 
                class="action-btn" 
                on:click={() => handleRepost(note.id, note.pubkey)}
                title="Repost"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="action-icon"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
                <span>Repost</span>
              </button>
              
              <button 
                class="action-btn" 
                on:click={() => activeNote = note}
                title="Reply"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="action-icon"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                <span>Reply</span>
              </button>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>
  
  <!-- Login modal -->
  {#if isShowingLogin}
    <div class="modal-backdrop" on:click={() => isShowingLogin = false}>
      <div class="modal-content" on:click|stopPropagation>
        <h2>Login to Nodus</h2>
        
        <p class="modal-description">
          Enter your private key (nsec or hex) to login
        </p>
        
        <div class="form-control">
          <input 
            type="password" 
            placeholder="nsec1... or hex private key"
            bind:value={privateKey}
            class="form-input"
          />
        </div>
        
        <div class="modal-actions">
          <button 
            class="btn btn-secondary" 
            on:click={() => isShowingLogin = false}
          >
            Cancel
          </button>
          
          <button 
            class="btn btn-primary" 
            on:click={handleLogin}
            disabled={!privateKey.trim() || isLoggingIn}
          >
            {isLoggingIn ? 'Logging in...' : 'Login'}
          </button>
        </div>
        
        <div class="modal-alternative">
          <p>
            Don't have an account?
            <button class="text-link" on:click={handleCreateAccount}>
              Create one now
            </button>
          </p>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .home-page {
    max-width: 800px;
    margin: 0 auto;
  }
  
  .auth-banner {
    padding: 2rem;
    background-color: var(--card-bg);
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    margin-bottom: 1.5rem;
    text-align: center;
  }
  
  .auth-banner h2 {
    font-size: 1.8rem;
    margin-bottom: 0.5rem;
    color: var(--nodus-blue);
  }
  
  .auth-banner p {
    color: var(--muted);
    margin-bottom: 1.5rem;
  }
  
  .auth-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
  }
  
  .new-note-form {
    margin-bottom: 1.5rem;
  }
  
  .form-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 1rem;
  }
  
  .notes-feed {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem 0;
    color: var(--muted);
  }
  
  .empty-notes {
    text-align: center;
    padding: 3rem 0;
    color: var(--muted);
  }
  
  .help-text {
    font-size: 0.9rem;
    opacity: 0.7;
  }
  
  .note-card {
    padding: 1.25rem;
  }
  
  .note-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 1rem;
  }
  
  .author-info {
    display: flex;
  }
  
  .author-link {
    display: flex;
    align-items: center;
    text-decoration: none;
    color: var(--foreground);
  }
  
  .avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    overflow: hidden;
    margin-right: 0.75rem;
    flex-shrink: 0;
  }
  
  .avatar-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--nodus-blue);
    color: white;
    font-weight: bold;
    text-transform: uppercase;
  }
  
  .author-meta {
    display: flex;
    flex-direction: column;
  }
  
  .author-name {
    font-weight: 600;
  }
  
  .note-time {
    font-size: 0.8rem;
    color: var(--muted);
  }
  
  .note-content {
    position: relative;
    margin-bottom: 1rem;
    overflow: hidden;
    max-height: 200px;
    transition: max-height 0.3s ease;
  }
  
  .note-content.expanded {
    max-height: none;
  }
  
  .note-content p {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }
  
  .read-more-btn {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    background: linear-gradient(transparent, var(--card-bg) 70%);
    border: none;
    padding: 2rem 0 0.5rem;
    text-align: center;
    color: var(--nodus-blue);
    font-weight: 500;
    cursor: pointer;
  }
  
  .note-actions {
    display: flex;
    gap: 1rem;
    border-top: 1px solid var(--border);
    padding-top: 1rem;
  }
  
  .action-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: none;
    border: none;
    color: var(--muted);
    font-size: 0.9rem;
    cursor: pointer;
    transition: color 0.2s;
    padding: 0.5rem;
  }
  
  .action-btn:hover {
    color: var(--nodus-blue);
  }
  
  .action-icon {
    width: 18px;
    height: 18px;
  }
  
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }
  
  .modal-content {
    background-color: var(--card-bg);
    border-radius: 8px;
    padding: 2rem;
    width: 100%;
    max-width: 500px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
  
  .modal-content h2 {
    font-size: 1.5rem;
    margin: 0 0 1rem;
    color: var(--nodus-blue);
  }
  
  .modal-description {
    margin-bottom: 1.5rem;
    color: var(--muted);
  }
  
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 1.5rem;
  }
  
  .modal-alternative {
    margin-top: 2rem;
    text-align: center;
    font-size: 0.9rem;
    color: var(--muted);
  }
  
  .text-link {
    background: none;
    border: none;
    padding: 0;
    color: var(--nodus-blue);
    font-weight: 500;
    cursor: pointer;
    text-decoration: underline;
  }
</style>