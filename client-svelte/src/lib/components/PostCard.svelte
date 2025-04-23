<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { Link } from 'svelte-routing';
  import { useProfile } from '@nostr-dev-kit/ndk-svelte';
  import { auth } from '../stores/auth';
  import { createReaction, createRepost, replyToNote } from '../services/nostr-event-service';
  import { formatDistance } from 'date-fns';
  
  // Props
  export let event;
  export let showActions = true;
  export let compact = false;
  
  // Local state
  let content = '';
  let showReplyForm = false;
  let replyContent = '';
  let isLiked = false;
  let isReposted = false;
  let reactions = { likes: 0, reposts: 0, replies: 0 };
  
  // Use NDK's profile hook
  const { profileContent, fetchProfile } = useProfile(event.pubkey);
  let author = null;
  
  // Create event dispatcher for component events
  const dispatch = createEventDispatcher();
  
  // Format date from unix timestamp
  function formatDate(timestamp) {
    return formatDistance(new Date(timestamp * 1000), new Date(), { addSuffix: true });
  }
  
  // Toggle reply form
  function toggleReplyForm() {
    showReplyForm = !showReplyForm;
  }
  
  // Handle like action
  async function handleLike() {
    if (!$auth.isAuthenticated) {
      return;
    }
    
    try {
      await createReaction(event.id);
      isLiked = true;
      reactions.likes++;
    } catch (error) {
      console.error('Error liking post:', error);
    }
  }
  
  // Handle repost action
  async function handleRepost() {
    if (!$auth.isAuthenticated) {
      return;
    }
    
    try {
      await createRepost(event.id);
      isReposted = true;
      reactions.reposts++;
    } catch (error) {
      console.error('Error reposting:', error);
    }
  }
  
  // Handle reply submission
  async function handleReply() {
    if (!$auth.isAuthenticated || !replyContent.trim()) {
      return;
    }
    
    try {
      // Find root ID if available
      const rootId = event.tags.find(t => t[0] === 'e' && t[3] === 'root')
        ? event.tags.find(t => t[0] === 'e' && t[3] === 'root')[1]
        : event.id;
      
      await replyToNote(event.id, rootId, replyContent);
      
      // Reset form and update UI
      replyContent = '';
      showReplyForm = false;
      reactions.replies++;
      
      // Notify parent
      dispatch('replied');
    } catch (error) {
      console.error('Error replying:', error);
    }
  }
  
  // Format post content
  $: {
    // Basic formatting for content
    let formattedContent = event.content;
    
    // Convert URLs to links
    formattedContent = formattedContent.replace(
      /(https?:\/\/[^\s]+)/g, 
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    
    // Convert nostr: references
    formattedContent = formattedContent.replace(
      /nostr:(npub[a-z0-9]+)/gi,
      '<a href="/profile/$1">$1</a>'
    );
    
    // Convert hashtags
    formattedContent = formattedContent.replace(
      /#(\w+)/g,
      '<a href="/search?tag=$1">#$1</a>'
    );
    
    content = formattedContent;
  }
  
  // Subscribe to profile changes
  $: if ($profileContent) {
    author = $profileContent;
  }
  
  // Fetch profile and reaction counts on mount
  onMount(async () => {
    fetchProfile();
    
    // Count reactions from event tags
    // In a real app, we would fetch these from the network
    reactions = {
      likes: event.tags.filter(t => t[0] === 'r' && t[1] === '+').length,
      reposts: event.tags.filter(t => t[0] === 'e' && t[3] === 'mention').length,
      replies: event.tags.filter(t => t[0] === 'e' && t[3] === 'reply').length
    };
  });
</script>

<div class="post-card {compact ? 'compact' : ''}">
  <!-- Author info -->
  <div class="post-header">
    {#if author && author.picture}
      <Link to={`/profile/${event.pubkey}`} class="author-avatar">
        <img src={author.picture} alt={author.name || 'User'} />
      </Link>
    {:else}
      <Link to={`/profile/${event.pubkey}`} class="author-avatar">
        <div class="avatar-placeholder">
          {author && author.name ? author.name[0].toUpperCase() : '?'}
        </div>
      </Link>
    {/if}
    
    <div class="author-info">
      <Link to={`/profile/${event.pubkey}`} class="author-name">
        {author && author.name ? author.name : 'Anonymous'}
      </Link>
      
      {#if author && author.nip05}
        <span class="author-nip05">✓ {author.nip05}</span>
      {/if}
      
      <span class="post-time">{formatDate(event.created_at)}</span>
    </div>
  </div>
  
  <!-- Post content -->
  <div class="post-content" on:click={() => dispatch('openPost', event)}>
    {@html content}
  </div>
  
  <!-- Action buttons -->
  {#if showActions && $auth.isAuthenticated}
    <div class="post-actions">
      <button class="action-btn {isLiked ? 'active' : ''}" on:click={handleLike}>
        ❤️ {reactions.likes > 0 ? reactions.likes : ''}
      </button>
      
      <button class="action-btn {isReposted ? 'active' : ''}" on:click={handleRepost}>
        🔁 {reactions.reposts > 0 ? reactions.reposts : ''}
      </button>
      
      <button class="action-btn" on:click={toggleReplyForm}>
        💬 {reactions.replies > 0 ? reactions.replies : ''}
      </button>
    </div>
    
    <!-- Reply form -->
    {#if showReplyForm}
      <div class="reply-form">
        <textarea 
          bind:value={replyContent} 
          placeholder="Write your reply..."
          rows="3"
        ></textarea>
        
        <div class="reply-actions">
          <button class="cancel-btn" on:click={toggleReplyForm}>Cancel</button>
          <button 
            class="reply-btn" 
            on:click={handleReply}
            disabled={!replyContent.trim()}
          >
            Reply
          </button>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .post-card {
    background-color: white;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    transition: background-color 0.3s;
  }
  
  :global(.dark) .post-card {
    background-color: #1e1e1e;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
  
  .post-card.compact {
    padding: 12px;
    margin-bottom: 8px;
  }
  
  .post-header {
    display: flex;
    align-items: center;
    margin-bottom: 12px;
  }
  
  .author-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    overflow: hidden;
    margin-right: 12px;
    flex-shrink: 0;
  }
  
  .post-card.compact .author-avatar {
    width: 36px;
    height: 36px;
  }
  
  .author-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
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
    font-size: 1.2rem;
  }
  
  .author-info {
    display: flex;
    flex-direction: column;
  }
  
  .author-name {
    font-weight: 600;
    text-decoration: none;
    color: inherit;
  }
  
  .author-name:hover {
    text-decoration: underline;
  }
  
  .author-nip05 {
    font-size: 0.8rem;
    color: #666;
    margin-top: 2px;
  }
  
  :global(.dark) .author-nip05 {
    color: #aaa;
  }
  
  .post-time {
    font-size: 0.8rem;
    color: #666;
  }
  
  :global(.dark) .post-time {
    color: #aaa;
  }
  
  .post-content {
    margin-bottom: 16px;
    word-break: break-word;
    cursor: pointer;
  }
  
  .post-content :global(a) {
    color: var(--nodus-blue);
    text-decoration: none;
  }
  
  .post-content :global(a:hover) {
    text-decoration: underline;
  }
  
  .post-actions {
    display: flex;
    gap: 16px;
    border-top: 1px solid #eee;
    padding-top: 12px;
  }
  
  :global(.dark) .post-actions {
    border-top-color: #333;
  }
  
  .action-btn {
    background: none;
    border: none;
    color: #666;
    cursor: pointer;
    font-size: 0.9rem;
    padding: 4px 8px;
    border-radius: 4px;
    transition: background-color 0.2s;
  }
  
  :global(.dark) .action-btn {
    color: #aaa;
  }
  
  .action-btn:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }
  
  :global(.dark) .action-btn:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .action-btn.active {
    color: var(--nodus-blue);
  }
  
  .reply-form {
    margin-top: 12px;
    border-top: 1px solid #eee;
    padding-top: 12px;
  }
  
  :global(.dark) .reply-form {
    border-top-color: #333;
  }
  
  .reply-form textarea {
    width: 100%;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 8px;
    margin-bottom: 8px;
    resize: none;
    font-family: inherit;
    font-size: 0.9rem;
    background-color: white;
    color: #333;
  }
  
  :global(.dark) .reply-form textarea {
    background-color: #333;
    color: #eee;
    border-color: #444;
  }
  
  .reply-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  
  .cancel-btn {
    background: none;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 0.9rem;
  }
  
  :global(.dark) .cancel-btn {
    border-color: #444;
    color: #eee;
  }
  
  .reply-btn {
    background-color: var(--nodus-blue);
    color: white;
    border: none;
    border-radius: 4px;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
  }
  
  .reply-btn:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
  
  :global(.dark) .reply-btn:disabled {
    background-color: #555;
  }
</style>