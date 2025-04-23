<script>
  import { onMount } from 'svelte';
  import { navigate } from 'svelte-routing';
  import Layout from '../../components/Layout.svelte';
  import { getConversations } from '../../lib/services/direct-message-service.js';
  import { getProfile, cachedProfiles } from '../../lib/services/profile-service.js';
  import { isAuthenticated, user } from '../../lib/stores/auth.js';
  import { format } from 'date-fns';
  
  let conversations = [];
  let isLoading = false;
  
  onMount(async () => {
    if (!$isAuthenticated) {
      navigate('/login');
      return;
    }
    
    await loadConversations();
  });
  
  // Function to load conversations
  async function loadConversations() {
    isLoading = true;
    
    try {
      // Get all conversation pubkeys
      const pubkeys = await getConversations();
      
      // Load profiles for these pubkeys
      await Promise.all(pubkeys.map(pubkey => getProfile(pubkey)));
      
      // Save the conversation list
      conversations = pubkeys;
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      isLoading = false;
    }
  }
  
  // Function to get contact name
  function getContactName(pubkey) {
    const profiles = $cachedProfiles;
    if (profiles.has(pubkey)) {
      const profile = profiles.get(pubkey);
      return profile.displayName || profile.name || 'Unknown User';
    }
    return 'Unknown User';
  }
  
  // Function to get contact picture
  function getContactPicture(pubkey) {
    const profiles = $cachedProfiles;
    if (profiles.has(pubkey)) {
      return profiles.get(pubkey).picture || '';
    }
    return '';
  }
  
  // Function to navigate to a conversation
  function openConversation(pubkey) {
    navigate(`/messages/${pubkey}`);
  }
</script>

<Layout title="Messages" {isLoading}>
  <div class="messages-page">
    <div class="conversations-list card">
      <div class="list-header">
        <h3>Conversations</h3>
      </div>
      
      {#if isLoading}
        <div class="spinner"></div>
      {:else if conversations.length === 0}
        <div class="empty-state">
          <p>No conversations yet. Start messaging other Nostr users to see them here.</p>
        </div>
      {:else}
        <ul class="conversation-items">
          {#each conversations as pubkey}
            <li class="conversation-item" on:click={() => openConversation(pubkey)}>
              <div class="contact-avatar">
                {#if getContactPicture(pubkey)}
                  <img src={getContactPicture(pubkey)} alt="Avatar" />
                {:else}
                  <div class="avatar-placeholder"></div>
                {/if}
              </div>
              <div class="conversation-info">
                <div class="contact-name">{getContactName(pubkey)}</div>
                <div class="contact-pubkey">{pubkey.substring(0, 8)}...{pubkey.substring(pubkey.length - 8)}</div>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
      
      <div class="new-message">
        <button class="btn">New Message</button>
      </div>
    </div>
    
    <div class="empty-conversation card">
      <div class="select-conversation-prompt">
        <h3>Select a conversation</h3>
        <p>Choose a conversation from the list or start a new one.</p>
      </div>
    </div>
  </div>
</Layout>

<style>
  .messages-page {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 1.5rem;
    height: calc(100vh - 200px);
    min-height: 500px;
  }
  
  .conversations-list {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 0;
    overflow: hidden;
  }
  
  .list-header {
    padding: 1.5rem;
    border-bottom: 1px solid #eee;
  }
  
  :global(body.dark) .list-header {
    border-bottom-color: #333;
  }
  
  .list-header h3 {
    margin: 0;
    color: var(--nodus-blue);
  }
  
  .conversation-items {
    list-style: none;
    padding: 0;
    margin: 0;
    overflow-y: auto;
    flex: 1;
  }
  
  .conversation-item {
    display: flex;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #eee;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  :global(body.dark) .conversation-item {
    border-bottom-color: #333;
  }
  
  .conversation-item:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }
  
  :global(body.dark) .conversation-item:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }
  
  .contact-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    overflow: hidden;
    margin-right: 1rem;
    background-color: #eee;
  }
  
  :global(body.dark) .contact-avatar {
    background-color: #444;
  }
  
  .contact-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .avatar-placeholder {
    width: 100%;
    height: 100%;
    background-color: var(--nodus-blue);
  }
  
  .conversation-info {
    flex: 1;
  }
  
  .contact-name {
    font-weight: 600;
    margin-bottom: 0.25rem;
  }
  
  .contact-pubkey {
    font-size: 0.75rem;
    color: #666;
    font-family: monospace;
  }
  
  :global(body.dark) .contact-pubkey {
    color: #aaa;
  }
  
  .new-message {
    padding: 1rem;
    border-top: 1px solid #eee;
    display: flex;
    justify-content: center;
  }
  
  :global(body.dark) .new-message {
    border-top-color: #333;
  }
  
  .empty-conversation {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }
  
  .select-conversation-prompt {
    text-align: center;
    color: #666;
    padding: 2rem;
  }
  
  :global(body.dark) .select-conversation-prompt {
    color: #aaa;
  }
  
  .select-conversation-prompt h3 {
    margin-top: 0;
    color: var(--nodus-blue);
  }
  
  .empty-state {
    text-align: center;
    padding: 3rem 1.5rem;
    color: #666;
  }
  
  :global(body.dark) .empty-state {
    color: #aaa;
  }
  
  /* Responsive styling */
  @media (max-width: 768px) {
    .messages-page {
      grid-template-columns: 1fr;
    }
    
    .empty-conversation {
      display: none;
    }
  }
</style>