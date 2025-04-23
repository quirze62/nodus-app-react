<script>
  import { onMount } from 'svelte';
  import { useNDK, useSubscription } from '@nostr-dev-kit/ndk-svelte';
  import { auth } from '../lib/stores/auth';
  import { toast } from '../lib/stores/toast';
  import { fetchNotes, publishNote } from '../lib/services/nostr-event-service';
  import PostCard from '../lib/components/PostCard.svelte';
  
  // Local state
  let notes = [];
  let isLoading = true;
  let newPostContent = '';
  let isPublishing = false;
  
  // Handle new post submission
  async function handleSubmitPost() {
    if (!$auth.isAuthenticated) {
      toast.error('You must be logged in to post');
      return;
    }
    
    if (!newPostContent.trim()) {
      return;
    }
    
    isPublishing = true;
    
    try {
      const result = await publishNote(newPostContent);
      
      if (result) {
        // Add new post to the top of the list
        notes = [result, ...notes];
        newPostContent = '';
        toast.success('Post published successfully');
      }
    } catch (error) {
      console.error('Error publishing note:', error);
      toast.error('Failed to publish post');
    } finally {
      isPublishing = false;
    }
  }
  
  // Handle post selection
  function handleOpenPost(event) {
    // Navigate to post details page
    console.log('Open post:', event.detail.id);
  }
  
  // Load initial notes
  async function loadNotes() {
    isLoading = true;
    
    try {
      const fetchedNotes = await fetchNotes();
      notes = fetchedNotes;
    } catch (error) {
      console.error('Error loading notes:', error);
      toast.error('Failed to load posts');
    } finally {
      isLoading = false;
    }
  }
  
  // Set up a subscription for real-time updates
  function setupSubscription() {
    const filter = {
      kinds: [1], // Text notes
      limit: 50
    };
    
    // Use NDK's subscription hook
    const { events } = useSubscription(filter);
    
    // Subscribe to new events
    events.subscribe(receivedEvents => {
      if (!receivedEvents || receivedEvents.length === 0) return;
      
      // Process new events
      for (const event of receivedEvents) {
        // Add new events to our notes if they're not already there
        if (!notes.some(n => n.id === event.id)) {
          notes = [event, ...notes].slice(0, 100); // Limit to 100 notes
        }
      }
    });
  }
  
  // Load data on mount
  onMount(async () => {
    await loadNotes();
    setupSubscription();
  });
</script>

<div class="home-page">
  <h1>Home Feed</h1>
  
  <!-- New post form -->
  {#if $auth.isAuthenticated}
    <div class="post-form">
      <textarea
        bind:value={newPostContent}
        placeholder="What's happening?"
        rows="3"
      ></textarea>
      
      <div class="post-actions">
        <span class="char-count {newPostContent.length > 280 ? 'over-limit' : ''}">
          {newPostContent.length}/280
        </span>
        
        <button 
          class="post-button" 
          on:click={handleSubmitPost}
          disabled={!newPostContent.trim() || newPostContent.length > 280 || isPublishing}
        >
          {isPublishing ? 'Posting...' : 'Post'}
        </button>
      </div>
    </div>
  {/if}
  
  <!-- Feed content -->
  <div class="feed">
    {#if isLoading}
      <div class="loading">
        <div class="spinner"></div>
        <p>Loading posts...</p>
      </div>
    {:else if notes.length === 0}
      <div class="empty-state">
        <p>No posts yet. Be the first to post something!</p>
      </div>
    {:else}
      {#each notes as note (note.id)}
        <PostCard 
          event={note} 
          on:openPost={handleOpenPost}
        />
      {/each}
    {/if}
  </div>
</div>

<style>
  .home-page {
    max-width: 600px;
    margin: 0 auto;
    padding: 0 1rem;
  }
  
  h1 {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 1.5rem;
    color: var(--nodus-blue);
  }
  
  .post-form {
    background-color: white;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  :global(.dark) .post-form {
    background-color: #1e1e1e;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
  
  textarea {
    width: 100%;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 12px;
    margin-bottom: 12px;
    resize: none;
    font-family: inherit;
    font-size: 1rem;
  }
  
  :global(.dark) textarea {
    background-color: #333;
    color: #eee;
    border-color: #444;
  }
  
  .post-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .char-count {
    font-size: 0.9rem;
    color: #666;
  }
  
  :global(.dark) .char-count {
    color: #aaa;
  }
  
  .char-count.over-limit {
    color: #e53e3e;
  }
  
  .post-button {
    background-color: var(--nodus-blue);
    color: white;
    border: none;
    border-radius: 9999px;
    padding: 0.5rem 1.5rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .post-button:hover:not(:disabled) {
    background-color: #0d47a1;
  }
  
  .post-button:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
  
  :global(.dark) .post-button:disabled {
    background-color: #555;
  }
  
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 0;
    color: #666;
  }
  
  :global(.dark) .loading {
    color: #aaa;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(0, 0, 0, 0.1);
    border-radius: 50%;
    border-top-color: var(--nodus-blue);
    animation: spin 1s ease-in-out infinite;
    margin-bottom: 1rem;
  }
  
  :global(.dark) .spinner {
    border-color: rgba(255, 255, 255, 0.1);
    border-top-color: var(--nodus-blue);
  }
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  
  .empty-state {
    text-align: center;
    padding: 3rem 0;
    color: #666;
  }
  
  :global(.dark) .empty-state {
    color: #aaa;
  }
</style>