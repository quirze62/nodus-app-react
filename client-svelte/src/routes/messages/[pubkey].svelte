<script>
  import { onMount, onDestroy } from 'svelte';
  import { navigate } from 'svelte-routing';
  import Layout from '../../components/Layout.svelte';
  import { getDirectMessages, sendDirectMessage, isLoading, error, messages } from '../../lib/services/direct-message-service.js';
  import { getProfile, cachedProfiles } from '../../lib/services/profile-service.js';
  import { isAuthenticated, user } from '../../lib/stores/auth.js';
  import { format } from 'date-fns';
  
  // Get the pubkey from the URL
  export let pubkey;
  
  let newMessageContent = '';
  let chatMessagesEl;
  let messagesList = [];
  
  $: if (pubkey && $messages) {
    const chatId = getChatId($user?.pubkey, pubkey);
    messagesList = $messages.get(chatId) || [];
  }
  
  onMount(async () => {
    if (!$isAuthenticated) {
      navigate('/login');
      return;
    }
    
    if (!pubkey) {
      navigate('/messages');
      return;
    }
    
    // Load the contact's profile
    await getProfile(pubkey);
    
    // Load messages
    await loadMessages();
  });
  
  // Function to load the chat messages
  async function loadMessages() {
    if (!pubkey || !$user) return;
    
    await getDirectMessages(pubkey);
    
    // Scroll to bottom of messages after a short delay to allow rendering
    setTimeout(scrollToBottom, 100);
  }
  
  // Function to send a message
  async function handleSendMessage() {
    if (!newMessageContent.trim() || !pubkey || !$user) return;
    
    try {
      await sendDirectMessage(pubkey, newMessageContent);
      newMessageContent = '';
      
      // Scroll to bottom after sending
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  }
  
  // Function to get contact name
  function getContactName(contactPubkey) {
    const profiles = $cachedProfiles;
    if (profiles.has(contactPubkey)) {
      const profile = profiles.get(contactPubkey);
      return profile.displayName || profile.name || 'Unknown User';
    }
    return 'Unknown User';
  }
  
  // Function to get contact picture
  function getContactPicture(contactPubkey) {
    const profiles = $cachedProfiles;
    if (profiles.has(contactPubkey)) {
      return profiles.get(contactPubkey).picture || '';
    }
    return '';
  }
  
  // Function to format a timestamp
  function formatTime(timestamp) {
    if (!timestamp) return '';
    // Convert to milliseconds if needed
    const date = new Date(timestamp * 1000);
    return format(date, 'h:mm a');
  }
  
  // Function to scroll to bottom of messages
  function scrollToBottom() {
    if (chatMessagesEl) {
      chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    }
  }
  
  // Helper function to get the chat ID
  function getChatId(pubkey1, pubkey2) {
    if (!pubkey1 || !pubkey2) return '';
    const keys = [pubkey1, pubkey2].sort();
    return `${keys[0]}_${keys[1]}`;
  }
</script>

<Layout title={getContactName(pubkey)} isLoading={$isLoading}>
  <div class="messages-page">
    <div class="back-link">
      <a href="/messages" on:click|preventDefault={() => navigate('/messages')}>
        ← Back to Conversations
      </a>
    </div>
    
    <div class="chat-container card">
      <div class="chat-header">
        <div class="contact-info">
          <div class="contact-avatar">
            {#if getContactPicture(pubkey)}
              <img src={getContactPicture(pubkey)} alt="Avatar" />
            {:else}
              <div class="avatar-placeholder"></div>
            {/if}
          </div>
          <div class="contact-details">
            <h3 class="contact-name">{getContactName(pubkey)}</h3>
            <div class="contact-pubkey">{pubkey.substring(0, 8)}...{pubkey.substring(pubkey.length - 8)}</div>
          </div>
        </div>
      </div>
      
      <div class="chat-messages" bind:this={chatMessagesEl}>
        {#if $error}
          <div class="error-message">
            <p>{$error}</p>
            <button class="btn" on:click={loadMessages}>Retry</button>
          </div>
        {:else if messagesList.length === 0}
          <div class="empty-chat">
            <p>No messages yet. Start the conversation by sending a message below.</p>
          </div>
        {:else}
          {#each messagesList as message}
            <div class="message-bubble" class:outgoing={message.pubkey === $user?.pubkey}>
              <div class="message-content">
                {#if message.plaintext}
                  <p>{message.plaintext}</p>
                {:else}
                  <p>{message.content}</p>
                {/if}
              </div>
              <div class="message-time">
                {formatTime(message.created_at)}
              </div>
            </div>
          {/each}
        {/if}
      </div>
      
      <div class="chat-input">
        <textarea 
          bind:value={newMessageContent} 
          placeholder="Type a message..." 
          on:keydown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
        ></textarea>
        <button class="btn send-btn" on:click={handleSendMessage} disabled={!newMessageContent.trim()}>
          Send
        </button>
      </div>
    </div>
  </div>
</Layout>

<style>
  .messages-page {
    max-width: 800px;
    margin: 0 auto;
  }
  
  .back-link {
    margin-bottom: 1rem;
  }
  
  .back-link a {
    color: var(--nodus-blue);
    text-decoration: none;
  }
  
  .chat-container {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 250px);
    min-height: 500px;
    padding: 0;
    overflow: hidden;
  }
  
  .chat-header {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #eee;
  }
  
  :global(body.dark) .chat-header {
    border-bottom-color: #333;
  }
  
  .contact-info {
    display: flex;
    align-items: center;
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
  
  .contact-details {
    flex: 1;
  }
  
  .contact-name {
    margin: 0 0 0.25rem 0;
  }
  
  .contact-pubkey {
    font-size: 0.75rem;
    color: #666;
    font-family: monospace;
  }
  
  :global(body.dark) .contact-pubkey {
    color: #aaa;
  }
  
  .chat-messages {
    flex: 1;
    padding: 1.5rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .message-bubble {
    max-width: 80%;
    background-color: #f1f1f1;
    border-radius: 18px;
    padding: 0.75rem 1rem;
    align-self: flex-start;
  }
  
  :global(body.dark) .message-bubble {
    background-color: #333;
  }
  
  .message-bubble.outgoing {
    background-color: var(--nodus-blue);
    color: white;
    align-self: flex-end;
  }
  
  .message-content p {
    margin: 0;
    white-space: pre-wrap;
  }
  
  .message-time {
    font-size: 0.7rem;
    margin-top: 0.25rem;
    opacity: 0.7;
    text-align: right;
  }
  
  .chat-input {
    padding: 1rem 1.5rem;
    border-top: 1px solid #eee;
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
  }
  
  :global(body.dark) .chat-input {
    border-top-color: #333;
  }
  
  .chat-input textarea {
    flex: 1;
    min-height: 24px;
    max-height: 120px;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    resize: vertical;
    font-family: inherit;
  }
  
  :global(body.dark) .chat-input textarea {
    background-color: #333;
    color: #eee;
    border-color: #555;
  }
  
  .send-btn {
    align-self: stretch;
  }
  
  .empty-chat {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: #666;
    padding: 0 2rem;
  }
  
  :global(body.dark) .empty-chat {
    color: #aaa;
  }
  
  .error-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: #d32f2f;
    padding: 0 2rem;
  }
  
  .error-message button {
    margin-top: 1rem;
  }
</style>