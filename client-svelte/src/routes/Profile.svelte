<script>
  import { onMount } from 'svelte';
  import { navigate } from 'svelte-routing';
  import Layout from '../components/Layout.svelte';
  import { loadUserNotes, userEvents, isLoading as notesLoading, error as notesError } from '../lib/services/nostr-event-service.js';
  import { getCurrentUserProfile, updateProfile, cachedProfiles, isLoading as profileLoading, error as profileError } from '../lib/services/profile-service.js';
  import { isAuthenticated, user } from '../lib/stores/auth.js';
  import { formatDistanceToNow } from 'date-fns';
  
  // Current user profile 
  let profile = {
    name: '',
    displayName: '',
    about: '',
    picture: '',
    banner: '',
    website: '',
    nip05: '',
    lud16: ''
  };
  
  // Editing state
  let isEditing = false;
  let editedProfile = { ...profile };
  let isSaving = false;
  let saveError = '';
  
  // Function to format date
  function formatDate(timestamp) {
    if (!timestamp) return '';
    
    // Convert from seconds to milliseconds if needed
    const date = new Date(timestamp * 1000);
    
    return formatDistanceToNow(date, { addSuffix: true });
  }
  
  // Load user data
  onMount(async () => {
    if (!$isAuthenticated) {
      navigate('/login');
      return;
    }
    
    try {
      // Load user profile
      const userProfile = await getCurrentUserProfile();
      if (userProfile) {
        profile = userProfile;
        editedProfile = { ...profile };
      }
      
      // Load user notes
      await loadUserNotes($user?.publicKey, 50);
    } catch (err) {
      console.error('[ERROR] Failed to load user data:', err);
    }
  });
  
  // Function to handle edit mode
  function startEditing() {
    editedProfile = { ...profile };
    isEditing = true;
  }
  
  // Function to cancel editing
  function cancelEditing() {
    editedProfile = { ...profile };
    isEditing = false;
    saveError = '';
  }
  
  // Function to save profile
  async function saveProfile() {
    if (!$isAuthenticated) {
      return;
    }
    
    try {
      isSaving = true;
      saveError = '';
      
      // Update the profile
      const success = await updateProfile(editedProfile);
      
      if (success) {
        // Update local state
        profile = { ...editedProfile };
        isEditing = false;
      } else {
        saveError = 'Failed to update profile';
      }
    } catch (err) {
      console.error('[ERROR] Failed to save profile:', err);
      saveError = err.message || 'Failed to save profile';
    } finally {
      isSaving = false;
    }
  }
  
  // Compute loading state
  $: isLoading = $profileLoading || $notesLoading;
  
  // Compute error state
  $: error = $profileError || $notesError;
</script>

<Layout title="Profile" {isLoading}>
  <div class="profile-page">
    {#if error}
      <div class="error-message card">
        <p>{error}</p>
      </div>
    {/if}
    
    <div class="profile-container card">
      <div class="profile-banner">
        {#if profile.banner}
          <img src={profile.banner} alt="Profile banner" />
        {/if}
      </div>
      
      <div class="profile-header">
        <div class="profile-avatar">
          {#if profile.picture}
            <img src={profile.picture} alt="Profile avatar" />
          {:else}
            <div class="avatar-placeholder"></div>
          {/if}
        </div>
        
        {#if isEditing}
          <div class="edit-actions">
            <button class="btn cancel-btn" on:click={cancelEditing}>
              Cancel
            </button>
            <button
              class="btn save-btn"
              on:click={saveProfile}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        {:else}
          <button class="btn edit-btn" on:click={startEditing}>
            Edit Profile
          </button>
        {/if}
      </div>
      
      {#if isEditing}
        <div class="profile-edit">
          {#if saveError}
            <div class="error-message">
              <p>{saveError}</p>
            </div>
          {/if}
          
          <div class="edit-form">
            <div class="form-group">
              <label for="name">Username</label>
              <input
                type="text"
                id="name"
                bind:value={editedProfile.name}
                placeholder="Username"
              />
            </div>
            
            <div class="form-group">
              <label for="displayName">Display Name</label>
              <input
                type="text"
                id="displayName"
                bind:value={editedProfile.displayName}
                placeholder="Display Name"
              />
            </div>
            
            <div class="form-group">
              <label for="picture">Profile Picture URL</label>
              <input
                type="text"
                id="picture"
                bind:value={editedProfile.picture}
                placeholder="https://example.com/avatar.jpg"
              />
            </div>
            
            <div class="form-group">
              <label for="banner">Banner Image URL</label>
              <input
                type="text"
                id="banner"
                bind:value={editedProfile.banner}
                placeholder="https://example.com/banner.jpg"
              />
            </div>
            
            <div class="form-group">
              <label for="about">About</label>
              <textarea
                id="about"
                bind:value={editedProfile.about}
                placeholder="Tell us about yourself"
                rows="4"
              ></textarea>
            </div>
            
            <div class="form-group">
              <label for="website">Website</label>
              <input
                type="text"
                id="website"
                bind:value={editedProfile.website}
                placeholder="https://example.com"
              />
            </div>
            
            <div class="form-group">
              <label for="nip05">NIP-05 Identifier</label>
              <input
                type="text"
                id="nip05"
                bind:value={editedProfile.nip05}
                placeholder="username@domain.com"
              />
              <p class="help-text">
                A NIP-05 identifier helps verify your identity on Nostr.
              </p>
            </div>
            
            <div class="form-group">
              <label for="lud16">Lightning Address</label>
              <input
                type="text"
                id="lud16"
                bind:value={editedProfile.lud16}
                placeholder="username@domain.com"
              />
              <p class="help-text">
                Bitcoin Lightning address for receiving payments.
              </p>
            </div>
          </div>
        </div>
      {:else}
        <div class="profile-info">
          <h2 class="profile-name">
            {profile.displayName || profile.name || 'Anonymous User'}
          </h2>
          
          {#if profile.name && profile.displayName !== profile.name}
            <p class="profile-username">@{profile.name}</p>
          {/if}
          
          {#if profile.about}
            <p class="profile-bio">{profile.about}</p>
          {/if}
          
          <div class="profile-meta">
            {#if profile.website}
              <div class="meta-item">
                <span class="meta-icon">🌐</span>
                <a href={profile.website} target="_blank" rel="noopener noreferrer">
                  {profile.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            {/if}
            
            {#if profile.nip05}
              <div class="meta-item">
                <span class="meta-icon">✓</span>
                <span class="meta-text">{profile.nip05}</span>
              </div>
            {/if}
            
            {#if $user}
              <div class="meta-item">
                <span class="meta-icon">🔑</span>
                <span class="meta-text">{$user.npub.substring(0, 8)}...{$user.npub.substring($user.npub.length - 8)}</span>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
    
    <div class="profile-tabs">
      <div class="tab active">Notes</div>
      <div class="tab">Replies</div>
      <div class="tab">Media</div>
      <div class="tab">Likes</div>
    </div>
    
    <div class="notes-container">
      {#if $userEvents.length === 0}
        <div class="empty-notes card">
          <h3>No notes yet</h3>
          <p>You haven't posted any notes yet. When you do, they will appear here.</p>
        </div>
      {:else}
        {#each $userEvents as note}
          <div class="note-item card">
            <div class="note-header">
              <div class="note-time">
                {formatDate(note.created_at)}
              </div>
            </div>
            
            <div class="note-content">
              {note.content}
            </div>
            
            <div class="note-actions">
              <button class="action-btn">
                <span class="action-icon">💬</span>
                <span class="action-label">Reply</span>
              </button>
              
              <button class="action-btn">
                <span class="action-icon">🔄</span>
                <span class="action-label">Repost</span>
              </button>
              
              <button class="action-btn">
                <span class="action-icon">❤️</span>
                <span class="action-label">Like</span>
              </button>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>
</Layout>

<style>
  .profile-page {
    max-width: 600px;
    margin: 0 auto;
  }
  
  .profile-container {
    margin-bottom: 2rem;
    overflow: visible;
  }
  
  .profile-banner {
    height: 200px;
    background-color: var(--nodus-blue);
    overflow: hidden;
  }
  
  .profile-banner img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .profile-header {
    display: flex;
    justify-content: space-between;
    padding: 0 1.5rem;
    margin-bottom: 1rem;
  }
  
  .profile-avatar {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    border: 4px solid white;
    overflow: hidden;
    margin-top: -60px;
    background-color: #eee;
  }
  
  :global(body.dark) .profile-avatar {
    border-color: #1a1a1a;
    background-color: #444;
  }
  
  .profile-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .avatar-placeholder {
    width: 100%;
    height: 100%;
    background-color: var(--nodus-blue);
  }
  
  .edit-btn, .edit-actions {
    margin-top: 1rem;
  }
  
  .edit-actions {
    display: flex;
    gap: 0.5rem;
  }
  
  .cancel-btn {
    background-color: #888;
  }
  
  .cancel-btn:hover {
    background-color: #777;
  }
  
  .profile-info {
    padding: 0 1.5rem 1.5rem;
  }
  
  .profile-name {
    margin: 0 0 0.5rem 0;
    font-size: 1.5rem;
  }
  
  .profile-username {
    margin: 0 0 1rem 0;
    color: #666;
    font-size: 1rem;
  }
  
  :global(body.dark) .profile-username {
    color: #aaa;
  }
  
  .profile-bio {
    margin: 0 0 1.5rem 0;
    line-height: 1.5;
    white-space: pre-wrap;
  }
  
  .profile-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
    color: #666;
    font-size: 0.875rem;
  }
  
  :global(body.dark) .profile-meta {
    color: #aaa;
  }
  
  .meta-item {
    display: flex;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  
  .meta-icon {
    margin-right: 0.5rem;
  }
  
  .profile-edit {
    padding: 0 1.5rem 1.5rem;
  }
  
  .edit-form {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
  
  .form-group {
    margin-bottom: 1rem;
  }
  
  .form-group:nth-child(3),
  .form-group:nth-child(4),
  .form-group:nth-child(5) {
    grid-column: 1 / span 2;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
  }
  
  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-family: inherit;
    font-size: 1rem;
    background-color: transparent;
  }
  
  :global(body.dark) .form-group input,
  :global(body.dark) .form-group textarea {
    border-color: #333;
    color: #eee;
  }
  
  .form-group textarea {
    resize: vertical;
  }
  
  .help-text {
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: #666;
  }
  
  :global(body.dark) .help-text {
    color: #aaa;
  }
  
  .error-message {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background-color: #ffebee;
    color: #d32f2f;
    border-radius: 0.5rem;
  }
  
  :global(body.dark) .error-message {
    background-color: rgba(211, 47, 47, 0.2);
  }
  
  .profile-tabs {
    display: flex;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid #eee;
  }
  
  :global(body.dark) .profile-tabs {
    border-bottom-color: #333;
  }
  
  .tab {
    padding: 1rem 1.5rem;
    cursor: pointer;
    color: #666;
    font-weight: 500;
    position: relative;
  }
  
  :global(body.dark) .tab {
    color: #aaa;
  }
  
  .tab.active {
    color: var(--nodus-blue);
    font-weight: 600;
  }
  
  .tab.active::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    width: 100%;
    height: 2px;
    background-color: var(--nodus-blue);
  }
  
  .notes-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .empty-notes {
    text-align: center;
    padding: 3rem 2rem;
  }
  
  .empty-notes h3 {
    margin-top: 0;
    color: var(--nodus-blue);
  }
  
  .note-item {
    padding: 1.5rem;
  }
  
  .note-header {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 1rem;
  }
  
  .note-time {
    font-size: 0.75rem;
    color: #666;
  }
  
  :global(body.dark) .note-time {
    color: #aaa;
  }
  
  .note-content {
    margin-bottom: 1.5rem;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }
  
  .note-actions {
    display: flex;
    gap: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid #eee;
  }
  
  :global(body.dark) .note-actions {
    border-top-color: #333;
  }
  
  .action-btn {
    background: none;
    border: none;
    display: flex;
    align-items: center;
    color: #666;
    font-size: 0.875rem;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 9999px;
    transition: background-color 0.2s;
  }
  
  :global(body.dark) .action-btn {
    color: #aaa;
  }
  
  .action-btn:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }
  
  :global(body.dark) .action-btn:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }
  
  .action-icon {
    font-size: 1rem;
    margin-right: 0.5rem;
  }
  
  @media (max-width: 768px) {
    .profile-header {
      flex-direction: column;
      align-items: flex-start;
    }
    
    .edit-btn, .edit-actions {
      margin-left: 60px;
    }
    
    .edit-form {
      grid-template-columns: 1fr;
    }
    
    .form-group:nth-child(3),
    .form-group:nth-child(4),
    .form-group:nth-child(5) {
      grid-column: auto;
    }
    
    .profile-tabs {
      overflow-x: auto;
      white-space: nowrap;
      padding-bottom: 0.5rem;
    }
    
    .tab {
      padding: 0.75rem 1rem;
      font-size: 0.875rem;
    }
    
    .action-label {
      display: none;
    }
    
    .action-icon {
      font-size: 1.25rem;
      margin-right: 0;
    }
    
    .note-actions {
      justify-content: space-around;
    }
  }
</style>