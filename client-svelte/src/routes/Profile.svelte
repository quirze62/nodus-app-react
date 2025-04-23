<script>
  import { onMount } from 'svelte';
  import { user } from '../lib/stores/auth.js';
  import { getProfile, cachedProfiles, updateProfile, isLoading, error } from '../lib/services/profile-service.js';
  import { getNotesByUser } from '../lib/services/nostr-event-service.js';
  import Layout from '../components/Layout.svelte';
  import { format } from 'date-fns';
  
  // Profile data for editing
  let profileData = {
    name: '',
    displayName: '',
    about: '',
    picture: '',
    nip05: ''
  };
  
  // User notes
  let userNotes = [];
  let isLoadingNotes = false;
  
  // Edit mode state
  let isEditMode = false;
  
  onMount(async () => {
    if ($user) {
      // Load current user's profile
      const profile = await getProfile($user.pubkey);
      
      // Initialize form data
      if (profile) {
        profileData = {
          name: profile.name || '',
          displayName: profile.displayName || '',
          about: profile.about || '',
          picture: profile.picture || '',
          nip05: profile.nip05 || ''
        };
      }
      
      // Load user's notes
      loadUserNotes();
    }
  });
  
  // Function to load user notes
  async function loadUserNotes() {
    if (!$user) return;
    
    isLoadingNotes = true;
    userNotes = await getNotesByUser($user.pubkey, 20);
    isLoadingNotes = false;
  }
  
  // Function to format a timestamp
  function formatDate(timestamp) {
    if (!timestamp) return '';
    // Convert to milliseconds if needed
    const date = new Date(timestamp * 1000);
    return format(date, 'MMM d, yyyy h:mm a');
  }
  
  // Function to toggle edit mode
  function toggleEditMode() {
    isEditMode = !isEditMode;
    
    // If canceling edit, reset form data
    if (!isEditMode && $user) {
      const profile = $cachedProfiles.get($user.pubkey);
      if (profile) {
        profileData = {
          name: profile.name || '',
          displayName: profile.displayName || '',
          about: profile.about || '',
          picture: profile.picture || '',
          nip05: profile.nip05 || ''
        };
      }
    }
  }
  
  // Function to save profile
  async function saveProfile() {
    if (!$user) return;
    
    const success = await updateProfile(profileData);
    
    if (success) {
      isEditMode = false;
    }
  }
</script>

<Layout isLoading={$isLoading} title={isEditMode ? 'Edit Profile' : 'Profile'}>
  <div class="profile-page">
    {#if $error}
      <div class="error-message card">
        <p>{$error}</p>
      </div>
    {/if}
    
    <div class="profile-header card">
      {#if !isEditMode}
        <!-- View mode -->
        <div class="profile-picture">
          {#if $user && $cachedProfiles.has($user.pubkey) && $cachedProfiles.get($user.pubkey).picture}
            <img src={$cachedProfiles.get($user.pubkey).picture} alt="Profile" />
          {:else}
            <div class="picture-placeholder"></div>
          {/if}
        </div>
        
        <div class="profile-info">
          <h3 class="profile-name">
            {#if $user && $cachedProfiles.has($user.pubkey)}
              {$cachedProfiles.get($user.pubkey).displayName || $cachedProfiles.get($user.pubkey).name || 'Unknown User'}
            {:else}
              Unknown User
            {/if}
          </h3>
          
          {#if $user}
            <div class="profile-pubkey">
              <span class="label">Pubkey:</span>
              <span class="value">{$user.pubkey.substring(0, 8)}...{$user.pubkey.substring($user.pubkey.length - 8)}</span>
            </div>
            
            {#if $user.npub}
              <div class="profile-npub">
                <span class="label">Npub:</span>
                <span class="value">{$user.npub.substring(0, 8)}...{$user.npub.substring($user.npub.length - 8)}</span>
              </div>
            {/if}
          {/if}
          
          {#if $user && $cachedProfiles.has($user.pubkey) && $cachedProfiles.get($user.pubkey).nip05}
            <div class="profile-nip05">
              <span class="label">NIP-05:</span>
              <span class="value">{$cachedProfiles.get($user.pubkey).nip05}</span>
            </div>
          {/if}
          
          {#if $user && $cachedProfiles.has($user.pubkey) && $cachedProfiles.get($user.pubkey).about}
            <div class="profile-about">
              <p>{$cachedProfiles.get($user.pubkey).about}</p>
            </div>
          {/if}
        </div>
        
        <div class="profile-actions">
          <button class="btn btn-outline" on:click={toggleEditMode}>Edit Profile</button>
        </div>
      {:else}
        <!-- Edit mode -->
        <form class="profile-form" on:submit|preventDefault={saveProfile}>
          <div class="form-group">
            <label for="name">Username</label>
            <input type="text" id="name" bind:value={profileData.name} placeholder="Username" />
          </div>
          
          <div class="form-group">
            <label for="displayName">Display Name</label>
            <input type="text" id="displayName" bind:value={profileData.displayName} placeholder="Display Name" />
          </div>
          
          <div class="form-group">
            <label for="picture">Profile Picture URL</label>
            <input type="text" id="picture" bind:value={profileData.picture} placeholder="https://example.com/your-image.jpg" />
          </div>
          
          <div class="form-group">
            <label for="nip05">NIP-05 Identifier</label>
            <input type="text" id="nip05" bind:value={profileData.nip05} placeholder="user@example.com" />
          </div>
          
          <div class="form-group">
            <label for="about">About</label>
            <textarea id="about" bind:value={profileData.about} rows="4" placeholder="Tell others about yourself"></textarea>
          </div>
          
          <div class="form-actions">
            <button type="button" class="btn btn-outline" on:click={toggleEditMode}>Cancel</button>
            <button type="submit" class="btn">Save Profile</button>
          </div>
        </form>
      {/if}
    </div>
    
    <div class="user-notes-section">
      <h3>Your Notes</h3>
      
      {#if isLoadingNotes}
        <div class="spinner"></div>
      {:else if userNotes.length > 0}
        <div class="notes-list">
          {#each userNotes as note}
            <div class="note-card card">
              <div class="note-content">
                <p>{note.content}</p>
              </div>
              <div class="note-meta">
                <span class="note-time">{formatDate(note.created_at)}</span>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="empty-state card">
          <p>You haven't posted any notes yet.</p>
        </div>
      {/if}
    </div>
  </div>
</Layout>

<style>
  .profile-page {
    max-width: 800px;
    margin: 0 auto;
  }
  
  .profile-header {
    display: flex;
    flex-wrap: wrap;
    padding: 2rem;
    margin-bottom: 2rem;
  }
  
  .profile-picture {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    overflow: hidden;
    margin-right: 1.5rem;
    background-color: #eee;
  }
  
  :global(body.dark) .profile-picture {
    background-color: #444;
  }
  
  .profile-picture img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .picture-placeholder {
    width: 100%;
    height: 100%;
    background-color: var(--nodus-blue);
  }
  
  .profile-info {
    flex: 1;
    min-width: 250px;
  }
  
  .profile-name {
    font-size: 1.5rem;
    margin-top: 0;
    margin-bottom: 0.5rem;
    color: var(--nodus-blue);
  }
  
  .profile-pubkey, .profile-npub, .profile-nip05 {
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
  }
  
  .label {
    font-weight: 600;
    margin-right: 0.5rem;
  }
  
  .value {
    color: #666;
    font-family: monospace;
  }
  
  :global(body.dark) .value {
    color: #aaa;
  }
  
  .profile-about {
    margin-top: 1rem;
  }
  
  .profile-about p {
    margin: 0;
    white-space: pre-wrap;
  }
  
  .profile-actions {
    width: 100%;
    margin-top: 1.5rem;
    display: flex;
    justify-content: flex-end;
  }
  
  .profile-form {
    width: 100%;
  }
  
  .form-group {
    margin-bottom: 1.5rem;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
  }
  
  .form-group input, .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-family: inherit;
    font-size: 1rem;
  }
  
  :global(body.dark) .form-group input, :global(body.dark) .form-group textarea {
    background-color: #333;
    color: #eee;
    border-color: #555;
  }
  
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
  }
  
  .user-notes-section {
    margin-top: 2rem;
  }
  
  .user-notes-section h3 {
    margin-bottom: 1rem;
    color: var(--nodus-blue);
  }
  
  .notes-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .note-card {
    padding: 1.5rem;
  }
  
  .note-content {
    margin-bottom: 1rem;
  }
  
  .note-content p {
    margin: 0;
    white-space: pre-wrap;
  }
  
  .note-meta {
    font-size: 0.875rem;
    color: #666;
    text-align: right;
  }
  
  :global(body.dark) .note-meta {
    color: #aaa;
  }
  
  .empty-state {
    text-align: center;
    padding: 3rem 1.5rem;
    color: #666;
  }
  
  :global(body.dark) .empty-state {
    color: #aaa;
  }
  
  .btn-outline {
    background-color: transparent;
    border: 1px solid var(--nodus-blue);
    color: var(--nodus-blue);
  }
  
  .error-message {
    color: #d32f2f;
    margin-bottom: 1rem;
    padding: 1rem;
  }
  
  @media (max-width: 600px) {
    .profile-header {
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    
    .profile-picture {
      margin-right: 0;
      margin-bottom: 1.5rem;
    }
    
    .profile-actions {
      justify-content: center;
    }
  }
</style>