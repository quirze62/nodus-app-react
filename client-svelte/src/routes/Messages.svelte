<script>
  import { onMount, onDestroy } from 'svelte';
  import { Link, useParams, navigate } from 'svelte-routing';
  import { useNDK, useProfile } from '@nostr-dev-kit/ndk-svelte';
  import { auth } from '../lib/stores/auth';
  import { toast } from '../lib/stores/toast';
  import { getMessages, sendMessage } from '../lib/services/nostr-event-service';
  import { fetchProfile, getFollowing } from '../lib/services/profile-service';
  
  // Route params
  const params = useParams();
  
  // Local state
  let contacts = [];
  let isLoadingContacts = true;
  let messages = [];
  let isLoadingMessages = true;
  let newMessage = '';
  let isSending = false;
  let messageInterval;
  let activeContact = null;
  
  // Selected contact pubkey from URL param
  $: selectedPubkey = $params.pubkey;
  
  // Load contacts (people the user follows)
  async function loadContacts() {
    if (!$auth.isAuthenticated) return;
    
    isLoadingContacts = true;
    
    try {
      // Get the user's following list
      const following = await getFollowing($auth.user.pubkey);
      
      // Load profile data for each contact
      const contactData = await Promise.all(
        following.map(async pubkey => {
          try {
            const profile = await fetchProfile(pubkey);
            return {
              pubkey,
              profile: profile || { name: 'Unknown' }
            };
          } catch (error) {
            console.error(`Error fetching profile for ${pubkey}:`, error);
            return {
              pubkey,
              profile: { name: 'Unknown' }
            };
          }
        })
      );
      
      contacts = contactData;
    } catch (error) {
      console.error('Error loading contacts:', error);
      toast.error('Failed to load contacts');
    } finally {
      isLoadingContacts = false;
    }
  }
  
  // Load messages with a contact
  async function loadMessages(pubkey) {
    if (!$auth.isAuthenticated || !pubkey) return;
    
    isLoadingMessages = true;
    
    try {
      // Get messages between the current user and selected contact
      const msgs = await getMessages(pubkey);
      messages = msgs;
      
      // Set active contact
      activeContact = contacts.find(c => c.pubkey === pubkey);
      
      // If no active contact found (might happen when directly accessing URL)
      if (!activeContact && pubkey) {
        try {
          const profile = await fetchProfile(pubkey);
          activeContact = {
            pubkey,
            profile: profile || { name: 'Unknown' }
          };
          
          // Add to contacts if not already there
          if (!contacts.some(c => c.pubkey === pubkey)) {
            contacts = [...contacts, activeContact];
          }
        } catch (e) {
          console.error('Error fetching contact profile:', e);
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages');
    } finally {
      isLoadingMessages = false;
      
      // Scroll to bottom of messages
      setTimeout(() => {
        const messageContainer = document.querySelector('.message-list');
        if (messageContainer) {
          messageContainer.scrollTop = messageContainer.scrollHeight;
        }
      }, 100);
    }
  }
  
  // Send a new message
  async function handleSendMessage() {
    if (!$auth.isAuthenticated || !selectedPubkey || !newMessage.trim()) return;
    
    isSending = true;
    
    try {
      // Send message using our service
      const result = await sendMessage(selectedPubkey, newMessage);
      
      if (result) {
        // Add new message to the list
        messages = [...messages, result];
        newMessage = '';
        
        // Scroll to bottom
        setTimeout(() => {
          const messageContainer = document.querySelector('.message-list');
          if (messageContainer) {
            messageContainer.scrollTop = messageContainer.scrollHeight;
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      isSending = false;
    }
  }
  
  // Format timestamp
  function formatMessageTime(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // Handle key press in message input
  function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  }
  
  // Select a contact
  function selectContact(pubkey) {
    navigate(`/messages/${pubkey}`);
  }
  
  // Set up polling for new messages
  function setupMessagePolling() {
    // Poll for new messages every 15 seconds
    messageInterval = setInterval(() => {
      if (selectedPubkey) {
        loadMessages(selectedPubkey);
      }
    }, 15000);
  }
  
  // Load data and setup when auth or selected pubkey changes
  $: if ($auth.isAuthenticated) {
    loadContacts();
    
    if (selectedPubkey) {
      loadMessages(selectedPubkey);
    }
  }
  
  // On mount, set up message polling
  onMount(() => {
    setupMessagePolling();
  });
  
  // On destroy, clear the interval
  onDestroy(() => {
    if (messageInterval) {
      clearInterval(messageInterval);
    }
  });
</script>

<div class="messages-page">
  {#if !$auth.isAuthenticated}
    <div class="auth-required">
      <h2>Authentication Required</h2>
      <p>You need to be logged in to view messages.</p>
      <Link to="/" class="back-link">Back to Home</Link>
    </div>
  {:else}
    <div class="messages-container">
      <!-- Contacts sidebar -->
      <div class="contacts-sidebar">
        <div class="contacts-header">
          <h2>Contacts</h2>
        </div>
        
        <div class="contacts-list">
          {#if isLoadingContacts}
            <div class="loading-contacts">
              <div class="spinner small"></div>
              <p>Loading contacts...</p>
            </div>
          {:else if contacts.length === 0}
            <div class="empty-contacts">
              <p>No contacts yet.</p>
              <p class="help-text">Follow someone to start messaging.</p>
            </div>
          {:else}
            {#each contacts as contact (contact.pubkey)}
              <div 
                class="contact-item {selectedPubkey === contact.pubkey ? 'active' : ''}"
                on:click={() => selectContact(contact.pubkey)}
              >
                <div class="contact-avatar">
                  {#if contact.profile && contact.profile.picture}
                    <img src={contact.profile.picture} alt={contact.profile.name} />
                  {:else}
                    <div class="avatar-placeholder">
                      {contact.profile && contact.profile.name ? contact.profile.name[0].toUpperCase() : '?'}
                    </div>
                  {/if}
                </div>
                
                <div class="contact-info">
                  <div class="contact-name">
                    {contact.profile && contact.profile.name ? contact.profile.name : 'Unknown'}
                  </div>
                  {#if contact.profile && contact.profile.nip05}
                    <div class="contact-nip05">
                      ✓ {contact.profile.nip05}
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>
      
      <!-- Message area -->
      <div class="message-area">
        {#if !selectedPubkey}
          <div class="no-chat-selected">
            <p>Select a contact to start messaging</p>
          </div>
        {:else}
          <!-- Chat header -->
          <div class="chat-header">
            {#if activeContact}
              <div class="chat-contact">
                <div class="contact-avatar small">
                  {#if activeContact.profile && activeContact.profile.picture}
                    <img src={activeContact.profile.picture} alt={activeContact.profile.name} />
                  {:else}
                    <div class="avatar-placeholder">
                      {activeContact.profile && activeContact.profile.name ? activeContact.profile.name[0].toUpperCase() : '?'}
                    </div>
                  {/if}
                </div>
                
                <div class="contact-info">
                  <div class="contact-name">
                    {activeContact.profile && activeContact.profile.name ? activeContact.profile.name : 'Unknown'}
                  </div>
                  {#if activeContact.profile && activeContact.profile.nip05}
                    <div class="contact-nip05">
                      ✓ {activeContact.profile.nip05}
                    </div>
                  {/if}
                </div>
              </div>
              
              <Link to={`/profile/${activeContact.pubkey}`} class="view-profile-btn">
                View Profile
              </Link>
            {/if}
          </div>
          
          <!-- Message list -->
          <div class="message-list">
            {#if isLoadingMessages}
              <div class="loading-messages">
                <div class="spinner"></div>
                <p>Loading messages...</p>
              </div>
            {:else if messages.length === 0}
              <div class="empty-messages">
                <p>No messages yet.</p>
                <p class="help-text">Send a message to start the conversation.</p>
              </div>
            {:else}
              {#each messages as message (message.id)}
                <div class="message-item {message.pubkey === $auth.user.pubkey ? 'outgoing' : 'incoming'}">
                  <div class="message-content">
                    {message.content}
                    <div class="message-time">
                      {formatMessageTime(message.created_at)}
                    </div>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
          
          <!-- Message input -->
          <div class="message-input">
            <textarea 
              bind:value={newMessage}
              placeholder="Type a message..."
              on:keydown={handleKeyPress}
              rows="3"
            ></textarea>
            
            <button 
              class="send-btn" 
              on:click={handleSendMessage}
              disabled={!newMessage.trim() || isSending}
            >
              {isSending ? '...' : 'Send'}
            </button>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .messages-page {
    height: calc(100vh - 64px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  
  .auth-required {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    padding: 2rem;
  }
  
  .auth-required h2 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
  }
  
  .auth-required p {
    color: #666;
    margin-bottom: 1.5rem;
  }
  
  :global(.dark) .auth-required p {
    color: #aaa;
  }
  
  .back-link {
    display: inline-block;
    background-color: var(--nodus-blue);
    color: white;
    text-decoration: none;
    padding: 0.5rem 1.5rem;
    border-radius: 9999px;
    font-weight: 600;
  }
  
  .messages-container {
    display: flex;
    height: 100%;
    overflow: hidden;
  }
  
  .contacts-sidebar {
    width: 280px;
    border-right: 1px solid #eee;
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  
  :global(.dark) .contacts-sidebar {
    border-right-color: #333;
  }
  
  @media (max-width: 640px) {
    .contacts-sidebar {
      width: 100px;
    }
  }
  
  .contacts-header {
    padding: 1rem;
    border-bottom: 1px solid #eee;
  }
  
  :global(.dark) .contacts-header {
    border-bottom-color: #333;
  }
  
  .contacts-header h2 {
    font-size: 1.2rem;
    font-weight: 600;
    margin: 0;
  }
  
  .contacts-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
  }
  
  .loading-contacts, .empty-contacts {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    padding: 2rem 0;
    color: #666;
  }
  
  :global(.dark) .loading-contacts,
  :global(.dark) .empty-contacts {
    color: #aaa;
  }
  
  .help-text {
    font-size: 0.9rem;
    opacity: 0.7;
    margin-top: 0.5rem;
  }
  
  .spinner {
    width: 36px;
    height: 36px;
    border: 3px solid rgba(0, 0, 0, 0.1);
    border-radius: 50%;
    border-top-color: var(--nodus-blue);
    animation: spin 1s ease-in-out infinite;
    margin-bottom: 1rem;
  }
  
  .spinner.small {
    width: 24px;
    height: 24px;
    border-width: 2px;
    margin-bottom: 0.5rem;
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
  
  .contact-item {
    display: flex;
    align-items: center;
    padding: 0.75rem;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s;
    margin-bottom: 0.25rem;
  }
  
  .contact-item:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }
  
  :global(.dark) .contact-item:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .contact-item.active {
    background-color: rgba(20, 92, 232, 0.1);
  }
  
  :global(.dark) .contact-item.active {
    background-color: rgba(20, 92, 232, 0.2);
  }
  
  .contact-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    overflow: hidden;
    margin-right: 0.75rem;
    flex-shrink: 0;
  }
  
  .contact-avatar.small {
    width: 36px;
    height: 36px;
  }
  
  .contact-avatar img {
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
  
  .contact-info {
    overflow: hidden;
  }
  
  @media (max-width: 640px) {
    .contact-info {
      display: none;
    }
  }
  
  .contact-name {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .contact-nip05 {
    font-size: 0.8rem;
    color: #666;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  :global(.dark) .contact-nip05 {
    color: #aaa;
  }
  
  .message-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  
  .no-chat-selected {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #666;
    text-align: center;
    padding: 2rem;
  }
  
  :global(.dark) .no-chat-selected {
    color: #aaa;
  }
  
  .chat-header {
    padding: 1rem;
    border-bottom: 1px solid #eee;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  :global(.dark) .chat-header {
    border-bottom-color: #333;
  }
  
  .chat-contact {
    display: flex;
    align-items: center;
  }
  
  .view-profile-btn {
    font-size: 0.9rem;
    color: var(--nodus-blue);
    text-decoration: none;
  }
  
  .message-list {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .loading-messages, .empty-messages {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: #666;
  }
  
  :global(.dark) .loading-messages,
  :global(.dark) .empty-messages {
    color: #aaa;
  }
  
  .message-item {
    display: flex;
    max-width: 80%;
  }
  
  .message-item.outgoing {
    align-self: flex-end;
  }
  
  .message-item.incoming {
    align-self: flex-start;
  }
  
  .message-content {
    padding: 0.75rem 1rem;
    border-radius: 18px;
    position: relative;
    word-break: break-word;
  }
  
  .message-item.outgoing .message-content {
    background-color: var(--nodus-blue);
    color: white;
    border-bottom-right-radius: 4px;
  }
  
  .message-item.incoming .message-content {
    background-color: #f0f0f0;
    color: #333;
    border-bottom-left-radius: 4px;
  }
  
  :global(.dark) .message-item.incoming .message-content {
    background-color: #333;
    color: #eee;
  }
  
  .message-time {
    font-size: 0.7rem;
    opacity: 0.7;
    text-align: right;
    margin-top: 0.25rem;
  }
  
  .message-input {
    padding: 1rem;
    border-top: 1px solid #eee;
    display: flex;
    gap: 0.75rem;
  }
  
  :global(.dark) .message-input {
    border-top-color: #333;
  }
  
  .message-input textarea {
    flex: 1;
    border: 1px solid #ddd;
    border-radius: 18px;
    padding: 0.75rem 1rem;
    resize: none;
    font-family: inherit;
    font-size: 0.95rem;
    min-height: 24px;
    max-height: 120px;
  }
  
  :global(.dark) .message-input textarea {
    background-color: #333;
    border-color: #444;
    color: #eee;
  }
  
  .send-btn {
    align-self: flex-end;
    background-color: var(--nodus-blue);
    color: white;
    border: none;
    border-radius: 50%;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-weight: 500;
    font-size: 0.9rem;
    padding: 0;
  }
  
  .send-btn:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
  
  :global(.dark) .send-btn:disabled {
    background-color: #555;
  }
</style>