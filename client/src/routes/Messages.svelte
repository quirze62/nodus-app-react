<script>
  import { onMount } from 'svelte';
  import { user } from '../lib/stores/auth.js';
  
  let currentUser;
  let conversations = [];
  let selectedConversation = null;
  let messages = [];
  let newMessage = '';
  let isLoading = true;
  let errorMessage = '';
  
  // Subscribe to user changes
  const unsubscribe = user.subscribe(value => {
    currentUser = value;
  });
  
  onMount(async () => {
    try {
      // Simulate loading conversations
      setTimeout(() => {
        conversations = [
          {
            pubkey: 'user1-pubkey',
            displayName: 'Alice',
            lastMessage: 'Hey there! How are you?',
            lastMessageAt: new Date().getTime() / 1000 - 3600,
            unread: 2
          },
          {
            pubkey: 'user2-pubkey',
            displayName: 'Bob',
            lastMessage: 'Did you see the new Nostr client?',
            lastMessageAt: new Date().getTime() / 1000 - 7200,
            unread: 0
          }
        ];
        isLoading = false;
      }, 1000);
    } catch (error) {
      console.error('Error loading conversations:', error);
      errorMessage = 'Failed to load conversations.';
      isLoading = false;
    }
  });
  
  async function selectConversation(conversation) {
    try {
      selectedConversation = conversation;
      
      // Mark conversation as read
      conversations = conversations.map(conv => {
        if (conv.pubkey === conversation.pubkey) {
          return { ...conv, unread: 0 };
        }
        return conv;
      });
      
      // Simulate loading messages for this conversation
      messages = [
        {
          id: '1',
          sender: conversation.pubkey,
          receiver: currentUser.pubkey,
          content: 'Hey there!',
          created_at: new Date().getTime() / 1000 - 3700
        },
        {
          id: '2',
          sender: currentUser.pubkey,
          receiver: conversation.pubkey,
          content: 'Hi! How are you?',
          created_at: new Date().getTime() / 1000 - 3650
        },
        {
          id: '3',
          sender: conversation.pubkey,
          receiver: currentUser.pubkey,
          content: 'I\'m good, thanks for asking!',
          created_at: new Date().getTime() / 1000 - 3600
        }
      ];
    } catch (error) {
      console.error('Error loading messages:', error);
      errorMessage = 'Failed to load messages.';
    }
  }
  
  async function sendMessage() {
    if (!newMessage.trim() || !selectedConversation) return;
    
    try {
      // Create a new message (this would be sent to relays in a real implementation)
      const message = {
        id: Date.now().toString(),
        sender: currentUser.pubkey,
        receiver: selectedConversation.pubkey,
        content: newMessage,
        created_at: Math.floor(Date.now() / 1000)
      };
      
      // Add to messages list
      messages = [...messages, message];
      
      // Update conversation with new last message
      conversations = conversations.map(conv => {
        if (conv.pubkey === selectedConversation.pubkey) {
          return {
            ...conv,
            lastMessage: newMessage,
            lastMessageAt: message.created_at
          };
        }
        return conv;
      });
      
      // Clear input
      newMessage = '';
    } catch (error) {
      console.error('Error sending message:', error);
      errorMessage = 'Failed to send message.';
    }
  }
  
  function formatTime(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  function formatDate(timestamp) {
    const date = new Date(timestamp * 1000);
    const today = new Date();
    
    // Check if the message is from today
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    
    // Check if the message is from yesterday
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    // Otherwise show the date
    return date.toLocaleDateString();
  }
  
  function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }
</script>

<div class="messages-container">
  {#if errorMessage}
    <div class="error-message">
      {errorMessage}
    </div>
  {/if}
  
  <div class="messages-layout">
    <div class="conversations-sidebar">
      <div class="sidebar-header">
        <h2>Messages</h2>
      </div>
      
      {#if isLoading}
        <div class="loading">
          <p>Loading conversations...</p>
        </div>
      {:else if conversations.length === 0}
        <div class="empty-state">
          <p>No conversations yet.</p>
        </div>
      {:else}
        <div class="conversations-list">
          {#each conversations as conversation}
            <div 
              class="conversation-item" 
              class:active={selectedConversation && selectedConversation.pubkey === conversation.pubkey}
              on:click={() => selectConversation(conversation)}
            >
              <div class="conversation-avatar"></div>
              <div class="conversation-details">
                <div class="conversation-header">
                  <span class="conversation-name">{conversation.displayName}</span>
                  <span class="conversation-time">{formatTime(conversation.lastMessageAt)}</span>
                </div>
                <div class="conversation-message">
                  {conversation.lastMessage}
                </div>
              </div>
              {#if conversation.unread > 0}
                <div class="unread-badge">{conversation.unread}</div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
    
    <div class="message-content">
      {#if !selectedConversation}
        <div class="no-conversation-selected">
          <p>Select a conversation to start messaging</p>
        </div>
      {:else}
        <div class="message-header">
          <div class="conversation-avatar"></div>
          <div class="message-header-details">
            <h3>{selectedConversation.displayName}</h3>
            <div class="user-pubkey">
              {selectedConversation.pubkey.slice(0, 8)}...{selectedConversation.pubkey.slice(-8)}
            </div>
          </div>
        </div>
        
        <div class="messages-list">
          {#each messages as message}
            <div class="message-item" class:sent={message.sender === currentUser.pubkey} class:received={message.sender !== currentUser.pubkey}>
              <div class="message-bubble">
                {message.content}
              </div>
              <div class="message-time">
                {formatTime(message.created_at)}
              </div>
            </div>
          {/each}
        </div>
        
        <div class="message-input">
          <textarea 
            placeholder="Type a message..." 
            bind:value={newMessage}
            on:keypress={handleKeyPress}
          ></textarea>
          <button on:click={sendMessage}>Send</button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .messages-container {
    height: calc(100vh - 120px);
    max-width: 1200px;
    margin: 0 auto;
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
  
  .messages-layout {
    display: flex;
    height: 100%;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  :global(body.dark) .messages-layout {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  
  /* Sidebar styles */
  .conversations-sidebar {
    width: 320px;
    background-color: white;
    border-right: 1px solid #eee;
    display: flex;
    flex-direction: column;
  }
  
  :global(body.dark) .conversations-sidebar {
    background-color: var(--bg-dark);
    border-right-color: #333;
  }
  
  .sidebar-header {
    padding: 16px;
    border-bottom: 1px solid #eee;
  }
  
  :global(body.dark) .sidebar-header {
    border-bottom-color: #333;
  }
  
  .sidebar-header h2 {
    margin: 0;
    font-size: 18px;
  }
  
  .loading, .empty-state {
    padding: 20px;
    text-align: center;
    color: #666;
  }
  
  :global(body.dark) .loading,
  :global(body.dark) .empty-state {
    color: #aaa;
  }
  
  .conversations-list {
    flex: 1;
    overflow-y: auto;
  }
  
  .conversation-item {
    padding: 12px 16px;
    display: flex;
    align-items: center;
    border-bottom: 1px solid #eee;
    cursor: pointer;
    position: relative;
  }
  
  :global(body.dark) .conversation-item {
    border-bottom-color: #333;
  }
  
  .conversation-item:hover {
    background-color: #f5f5f5;
  }
  
  :global(body.dark) .conversation-item:hover {
    background-color: #333;
  }
  
  .conversation-item.active {
    background-color: #e8f0fe;
  }
  
  :global(body.dark) .conversation-item.active {
    background-color: #1a3a6d;
  }
  
  .conversation-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: var(--primary-color);
    margin-right: 12px;
    flex-shrink: 0;
  }
  
  .conversation-details {
    flex: 1;
    min-width: 0;
  }
  
  .conversation-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 4px;
  }
  
  .conversation-name {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .conversation-time {
    color: #666;
    font-size: 12px;
    white-space: nowrap;
    margin-left: 8px;
  }
  
  :global(body.dark) .conversation-time {
    color: #aaa;
  }
  
  .conversation-message {
    color: #666;
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  :global(body.dark) .conversation-message {
    color: #aaa;
  }
  
  .unread-badge {
    background-color: var(--primary-color);
    color: white;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    margin-left: 8px;
  }
  
  /* Message content styles */
  .message-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    background-color: white;
  }
  
  :global(body.dark) .message-content {
    background-color: var(--bg-dark);
  }
  
  .no-conversation-selected {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    color: #666;
    font-size: 16px;
  }
  
  :global(body.dark) .no-conversation-selected {
    color: #aaa;
  }
  
  .message-header {
    padding: 12px 16px;
    border-bottom: 1px solid #eee;
    display: flex;
    align-items: center;
  }
  
  :global(body.dark) .message-header {
    border-bottom-color: #333;
  }
  
  .message-header-details {
    margin-left: 12px;
  }
  
  .message-header-details h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }
  
  .user-pubkey {
    color: #666;
    font-size: 12px;
    font-family: monospace;
  }
  
  :global(body.dark) .user-pubkey {
    color: #aaa;
  }
  
  .messages-list {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .message-item {
    display: flex;
    flex-direction: column;
    max-width: 70%;
  }
  
  .message-item.sent {
    align-self: flex-end;
  }
  
  .message-item.received {
    align-self: flex-start;
  }
  
  .message-bubble {
    padding: 10px 14px;
    border-radius: 18px;
    word-break: break-word;
  }
  
  .message-item.sent .message-bubble {
    background-color: var(--primary-color);
    color: white;
    border-bottom-right-radius: 4px;
  }
  
  .message-item.received .message-bubble {
    background-color: #f0f0f0;
    border-bottom-left-radius: 4px;
  }
  
  :global(body.dark) .message-item.received .message-bubble {
    background-color: #333;
  }
  
  .message-time {
    font-size: 12px;
    color: #666;
    margin-top: 4px;
    align-self: flex-end;
  }
  
  :global(body.dark) .message-time {
    color: #aaa;
  }
  
  .message-input {
    padding: 16px;
    border-top: 1px solid #eee;
    display: flex;
    gap: 12px;
  }
  
  :global(body.dark) .message-input {
    border-top-color: #333;
  }
  
  .message-input textarea {
    flex: 1;
    resize: none;
    border: 1px solid #ddd;
    border-radius: 20px;
    padding: 10px 14px;
    font-family: inherit;
    font-size: 14px;
    max-height: 100px;
  }
  
  :global(body.dark) .message-input textarea {
    border-color: #444;
    background-color: #222;
    color: white;
  }
  
  .message-input textarea:focus {
    outline: none;
    border-color: var(--primary-color);
  }
  
  .message-input button {
    background-color: var(--primary-color);
    color: white;
    border: none;
    border-radius: 20px;
    padding: 8px 16px;
    font-weight: 500;
    cursor: pointer;
    align-self: flex-end;
  }
</style>