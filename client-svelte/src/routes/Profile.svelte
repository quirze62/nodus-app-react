<script>
  import { onMount } from 'svelte';
  import { user } from '../lib/stores/auth.js';
  
  let currentUser;
  let profileData = null;
  let isLoading = true;
  let isEditing = false;
  let errorMessage = '';
  let userNotes = [];
  
  // Form fields
  let displayName = '';
  let about = '';
  let picture = '';
  let nip05 = '';
  let website = '';
  
  // Subscribe to user changes
  const unsubscribe = user.subscribe(value => {
    currentUser = value;
  });
  
  onMount(async () => {
    try {
      if (currentUser) {
        // Simulate profile data loading
        setTimeout(() => {
          profileData = {
            pubkey: currentUser.pubkey,
            displayName: currentUser.displayName || 'Nodus User',
            about: 'No bio provided yet.',
            picture: '',
            nip05: '',
            website: ''
          };
          
          // Initialize form fields
          displayName = profileData.displayName || '';
          about = profileData.about || '';
          picture = profileData.picture || '';
          nip05 = profileData.nip05 || '';
          website = profileData.website || '';
          
          // Simulate user notes
          userNotes = [
            {
              id: '1',
              pubkey: currentUser.pubkey,
              content: 'This is a sample note from your profile.',
              created_at: new Date().getTime() / 1000 - 3600
            }
          ];
          
          isLoading = false;
        }, 1000);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      errorMessage = 'Failed to load profile data.';
      isLoading = false;
    }
  });
  
  function toggleEdit() {
    isEditing = !isEditing;
    
    if (isEditing) {
      // Initialize form values from current profile
      displayName = profileData.displayName || '';
      about = profileData.about || '';
      picture = profileData.picture || '';
      nip05 = profileData.nip05 || '';
      website = profileData.website || '';
    }
  }
  
  async function saveProfile() {
    try {
      // Update profile data (this would be persisted in a real implementation)
      profileData = {
        ...profileData,
        displayName,
        about,
        picture,
        nip05,
        website
      };
      
      isEditing = false;
    } catch (error) {
      console.error('Error saving profile:', error);
      errorMessage = 'Failed to update profile.';
    }
  }
  
  function formatTime(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
</script>

<div class="profile-container">
  {#if isLoading}
    <div class="loading">
      <p>Loading profile...</p>
    </div>
  {:else if errorMessage}
    <div class="error-message">
      {errorMessage}
    </div>
  {:else}
    <div class="profile-header">
      <div class="profile-info">
        <div class="profile-avatar">
          {#if profileData.picture}
            <img src={profileData.picture} alt="Profile" />
          {:else}
            <div class="avatar-placeholder"></div>
          {/if}
        </div>
        
        <div class="profile-details">
          <h1>{profileData.displayName}</h1>
          
          <div class="profile-pubkey">
            {profileData.pubkey.slice(0, 8)}...{profileData.pubkey.slice(-8)}
          </div>
          
          {#if profileData.nip05}
            <div class="profile-nip05">
              ✓ {profileData.nip05}
            </div>
          {/if}
          
          {#if profileData.website}
            <div class="profile-website">
              <a href={profileData.website} target="_blank" rel="noopener noreferrer">
                {profileData.website}
              </a>
            </div>
          {/if}
          
          <div class="profile-about">
            {profileData.about}
          </div>
        </div>
      </div>
      
      {#if currentUser && currentUser.pubkey === profileData.pubkey}
        <div class="profile-actions">
          <button on:click={toggleEdit}>
            {isEditing ? 'Cancel' : 'Edit Profile'}
          </button>
        </div>
      {/if}
    </div>
    
    {#if isEditing}
      <div class="edit-profile">
        <h2>Edit Profile</h2>
        
        <div class="form-group">
          <label for="displayName">Display Name</label>
          <input type="text" id="displayName" bind:value={displayName} />
        </div>
        
        <div class="form-group">
          <label for="about">About</label>
          <textarea id="about" bind:value={about} rows="3"></textarea>
        </div>
        
        <div class="form-group">
          <label for="picture">Profile Picture URL</label>
          <input type="text" id="picture" bind:value={picture} />
        </div>
        
        <div class="form-group">
          <label for="nip05">NIP-05 Identifier</label>
          <input type="text" id="nip05" bind:value={nip05} />
        </div>
        
        <div class="form-group">
          <label for="website">Website</label>
          <input type="text" id="website" bind:value={website} />
        </div>
        
        <div class="form-actions">
          <button class="cancel-button" on:click={toggleEdit}>Cancel</button>
          <button class="save-button" on:click={saveProfile}>Save Profile</button>
        </div>
      </div>
    {/if}
    
    <div class="profile-content">
      <h2>Notes</h2>
      
      {#if userNotes.length === 0}
        <div class="empty-state">
          <p>No notes to display.</p>
        </div>
      {:else}
        <div class="notes-list">
          {#each userNotes as note}
            <div class="note-card">
              <div class="note-header">
                <div class="user-info">
                  <div class="user-name">
                    {profileData.displayName}
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
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .profile-container {
    max-width: 800px;
    margin: 0 auto;
  }
  
  .loading {
    text-align: center;
    padding: 40px 0;
    color: #666;
  }
  
  :global(body.dark) .loading {
    color: #aaa;
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
  
  .profile-header {
    background-color: white;
    border-radius: 8px;
    padding: 24px;
    margin-bottom: 24px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  
  :global(body.dark) .profile-header {
    background-color: var(--bg-dark);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  
  .profile-info {
    display: flex;
    gap: 20px;
  }
  
  .profile-avatar {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    overflow: hidden;
  }
  
  .avatar-placeholder {
    width: 100%;
    height: 100%;
    background-color: var(--primary-color);
  }
  
  .profile-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .profile-details {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .profile-details h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
  }
  
  .profile-pubkey {
    font-family: monospace;
    color: #666;
    font-size: 14px;
  }
  
  :global(body.dark) .profile-pubkey {
    color: #aaa;
  }
  
  .profile-nip05 {
    color: #28a745;
    font-size: 14px;
  }
  
  .profile-website {
    font-size: 14px;
  }
  
  .profile-website a {
    color: var(--primary-color);
    text-decoration: none;
  }
  
  .profile-website a:hover {
    text-decoration: underline;
  }
  
  .profile-about {
    margin-top: 8px;
    line-height: 1.5;
    max-width: 500px;
    white-space: pre-wrap;
  }
  
  .profile-actions button {
    background-color: transparent;
    border: 1px solid var(--primary-color);
    color: var(--primary-color);
    padding: 8px 16px;
    border-radius: 20px;
    cursor: pointer;
    transition: background-color 0.3s;
  }
  
  .profile-actions button:hover {
    background-color: rgba(20, 92, 232, 0.1);
  }
  
  .edit-profile {
    background-color: white;
    border-radius: 8px;
    padding: 24px;
    margin-bottom: 24px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  :global(body.dark) .edit-profile {
    background-color: var(--bg-dark);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  
  .edit-profile h2 {
    margin-top: 0;
    margin-bottom: 20px;
    font-size: 20px;
  }
  
  .form-group {
    margin-bottom: 16px;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
  }
  
  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 16px;
    font-family: inherit;
  }
  
  :global(body.dark) .form-group input,
  :global(body.dark) .form-group textarea {
    border-color: #444;
    background-color: #222;
    color: white;
  }
  
  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--primary-color);
  }
  
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 20px;
  }
  
  .cancel-button {
    background-color: transparent;
    border: 1px solid #ddd;
    color: #666;
  }
  
  :global(body.dark) .cancel-button {
    border-color: #444;
    color: #aaa;
  }
  
  .save-button {
    background-color: var(--primary-color);
    color: white;
  }
  
  .profile-content {
    margin-top: 32px;
  }
  
  .profile-content h2 {
    margin-bottom: 16px;
    font-size: 20px;
  }
  
  .empty-state {
    text-align: center;
    padding: 40px 0;
    color: #666;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  :global(body.dark) .empty-state {
    color: #aaa;
    background-color: var(--bg-dark);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  
  .notes-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  
  .note-card {
    background-color: white;
    border-radius: 8px;
    padding: 16px;
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