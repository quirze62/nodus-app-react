<script>
  import { onMount } from 'svelte';
  import { Link, useParams } from 'svelte-routing';
  import { useNDK, useProfile, useEvents } from '@nostr-dev-kit/ndk-svelte';
  import { auth } from '../lib/stores/auth';
  import { toast } from '../lib/stores/toast';
  import { fetchNotes } from '../lib/services/nostr-event-service';
  import { fetchProfile, followUser, unfollowUser, getFollowers, getFollowing, updateProfile } from '../lib/services/profile-service';
  import PostCard from '../lib/components/PostCard.svelte';
  
  // Route params
  const params = useParams();
  
  // Local state
  let profileData = null;
  let isLoading = true;
  let userNotes = [];
  let isLoadingNotes = true;
  let isCurrentUser = false;
  let isFollowing = false;
  let followerCount = 0;
  let followingCount = 0;
  let showEditForm = false;
  let editFormData = {
    name: '',
    about: '',
    picture: '',
    nip05: ''
  };
  let isUpdating = false;
  
  // Get pubkey from params or current user
  $: pubkey = $params.pubkey || ($auth.isAuthenticated ? $auth.user.pubkey : null);
  
  // Check if this is the current user's profile
  $: isCurrentUser = $auth.isAuthenticated && $auth.user && $auth.user.pubkey === pubkey;
  
  // Use NDK's profile hook for reactive updates
  $: { 
    const { profileContent } = useProfile(pubkey);
    profileContent.subscribe(profile => {
      if (profile) {
        profileData = { ...profile, pubkey };
        
        // Update edit form data if this is the current user
        if (isCurrentUser) {
          editFormData = {
            name: profile.name || '',
            about: profile.about || '',
            picture: profile.picture || '',
            nip05: profile.nip05 || ''
          };
        }
      }
    });
  }
  
  // Load profile data
  async function loadProfile() {
    if (!pubkey) return;
    
    isLoading = true;
    
    try {
      const profile = await fetchProfile(pubkey);
      if (profile) {
        profileData = { ...profile, pubkey };
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Failed to load profile');
    } finally {
      isLoading = false;
    }
  }
  
  // Load user's notes
  async function loadUserNotes() {
    if (!pubkey) return;
    
    isLoadingNotes = true;
    
    try {
      // Use the filter to get only notes from this user
      const filter = {
        kinds: [1], // Text notes
        authors: [pubkey],
        limit: 50
      };
      
      const notes = await fetchNotes(filter);
      userNotes = notes;
    } catch (error) {
      console.error('Error loading user notes:', error);
      toast.error('Failed to load posts');
    } finally {
      isLoadingNotes = false;
    }
  }
  
  // Load follower and following counts
  async function loadFollowData() {
    if (!pubkey) return;
    
    try {
      // Get followers and following in parallel
      const [followers, following] = await Promise.all([
        getFollowers(pubkey),
        getFollowing(pubkey)
      ]);
      
      followerCount = followers.length;
      followingCount = following.length;
      
      // Check if current user is following this profile
      if ($auth.isAuthenticated && $auth.user && $auth.user.pubkey !== pubkey) {
        const currentUserFollowing = await getFollowing($auth.user.pubkey);
        isFollowing = currentUserFollowing.includes(pubkey);
      }
    } catch (error) {
      console.error('Error loading follow data:', error);
    }
  }
  
  // Toggle follow status
  async function toggleFollow() {
    if (!$auth.isAuthenticated) {
      toast.error('You must be logged in to follow users');
      return;
    }
    
    try {
      if (isFollowing) {
        await unfollowUser(pubkey);
        isFollowing = false;
        followerCount = Math.max(0, followerCount - 1);
        toast.success('Unfollowed user');
      } else {
        await followUser(pubkey);
        isFollowing = true;
        followerCount++;
        toast.success('Following user');
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast.error('Failed to update follow status');
    }
  }
  
  // Toggle edit profile form
  function toggleEditForm() {
    showEditForm = !showEditForm;
    
    // Reset form data from profile
    if (showEditForm && profileData) {
      editFormData = {
        name: profileData.name || '',
        about: profileData.about || '',
        picture: profileData.picture || '',
        nip05: profileData.nip05 || ''
      };
    }
  }
  
  // Submit profile updates
  async function handleUpdateProfile() {
    if (!isCurrentUser) return;
    
    isUpdating = true;
    
    try {
      const success = await updateProfile(editFormData);
      
      if (success) {
        // Update local profile data
        profileData = { 
          ...profileData,
          ...editFormData
        };
        
        showEditForm = false;
        toast.success('Profile updated successfully');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      isUpdating = false;
    }
  }
  
  // Load data on mount and when pubkey changes
  $: if (pubkey) {
    loadProfile();
    loadUserNotes();
    loadFollowData();
  }
</script>

<div class="profile-page">
  {#if isLoading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading profile...</p>
    </div>
  {:else if !profileData}
    <div class="not-found">
      <h2>Profile Not Found</h2>
      <p>This user doesn't exist or hasn't set up their profile yet.</p>
      <Link to="/" class="back-link">Back to Home</Link>
    </div>
  {:else}
    <!-- Profile header -->
    <div class="profile-header">
      <div class="profile-banner"></div>
      
      <div class="profile-info">
        <div class="profile-avatar">
          {#if profileData.picture}
            <img src={profileData.picture} alt={profileData.name || 'User'} />
          {:else}
            <div class="avatar-placeholder">
              {profileData.name ? profileData.name[0].toUpperCase() : '?'}
            </div>
          {/if}
        </div>
        
        <div class="profile-details">
          <h1>{profileData.name || 'Anonymous'}</h1>
          
          {#if profileData.nip05}
            <div class="profile-nip05">✓ {profileData.nip05}</div>
          {/if}
          
          <div class="profile-pubkey">
            <span class="pubkey-label">Pubkey:</span>
            <span class="pubkey-value">{pubkey.substring(0, 8)}...{pubkey.substring(pubkey.length - 4)}</span>
          </div>
          
          {#if profileData.about}
            <div class="profile-bio">
              {profileData.about}
            </div>
          {/if}
          
          <div class="profile-stats">
            <div class="stat">
              <span class="stat-count">{userNotes.length}</span>
              <span class="stat-label">Posts</span>
            </div>
            <div class="stat">
              <span class="stat-count">{followerCount}</span>
              <span class="stat-label">Followers</span>
            </div>
            <div class="stat">
              <span class="stat-count">{followingCount}</span>
              <span class="stat-label">Following</span>
            </div>
          </div>
          
          <div class="profile-actions">
            {#if isCurrentUser}
              <button class="edit-profile-btn" on:click={toggleEditForm}>
                Edit Profile
              </button>
            {:else if $auth.isAuthenticated}
              <button 
                class="follow-btn {isFollowing ? 'following' : ''}" 
                on:click={toggleFollow}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            {/if}
          </div>
        </div>
      </div>
    </div>
    
    <!-- Edit Profile Form -->
    {#if showEditForm}
      <div class="edit-profile-form">
        <h2>Edit Profile</h2>
        
        <div class="form-group">
          <label for="name">Name</label>
          <input 
            type="text" 
            id="name" 
            bind:value={editFormData.name} 
            placeholder="Your name"
          />
        </div>
        
        <div class="form-group">
          <label for="about">About</label>
          <textarea 
            id="about" 
            bind:value={editFormData.about} 
            placeholder="Tell us about yourself"
            rows="3"
          ></textarea>
        </div>
        
        <div class="form-group">
          <label for="picture">Profile Image URL</label>
          <input 
            type="text" 
            id="picture" 
            bind:value={editFormData.picture} 
            placeholder="https://example.com/your-image.jpg"
          />
        </div>
        
        <div class="form-group">
          <label for="nip05">NIP-05 Identifier</label>
          <input 
            type="text" 
            id="nip05" 
            bind:value={editFormData.nip05} 
            placeholder="you@example.com"
          />
        </div>
        
        <div class="form-actions">
          <button class="cancel-btn" on:click={toggleEditForm}>Cancel</button>
          <button 
            class="save-btn" 
            on:click={handleUpdateProfile}
            disabled={isUpdating}
          >
            {isUpdating ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    {/if}
    
    <!-- User's posts -->
    <div class="profile-posts">
      <h2>Posts</h2>
      
      {#if isLoadingNotes}
        <div class="loading-notes">
          <div class="spinner small"></div>
          <p>Loading posts...</p>
        </div>
      {:else if userNotes.length === 0}
        <div class="empty-posts">
          <p>No posts yet.</p>
        </div>
      {:else}
        {#each userNotes as note (note.id)}
          <PostCard event={note} />
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .profile-page {
    max-width: 800px;
    margin: 0 auto;
    padding: 0 1rem;
  }
  
  .loading, .not-found {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 0;
    text-align: center;
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
  
  .spinner.small {
    width: 24px;
    height: 24px;
    border-width: 2px;
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
  
  .not-found h2 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
    color: #333;
  }
  
  :global(.dark) .not-found h2 {
    color: #eee;
  }
  
  .not-found p {
    color: #666;
    margin-bottom: 1.5rem;
  }
  
  :global(.dark) .not-found p {
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
  
  .profile-header {
    background-color: white;
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  :global(.dark) .profile-header {
    background-color: #1e1e1e;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
  
  .profile-banner {
    height: 150px;
    background-color: var(--nodus-blue);
    opacity: 0.8;
  }
  
  .profile-info {
    padding: 1rem;
    position: relative;
  }
  
  .profile-avatar {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    border: 4px solid white;
    overflow: hidden;
    position: absolute;
    top: -60px;
    left: 2rem;
    background-color: white;
  }
  
  :global(.dark) .profile-avatar {
    border-color: #1e1e1e;
    background-color: #333;
  }
  
  .profile-avatar img {
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
    font-size: 3rem;
  }
  
  .profile-details {
    margin-left: 150px;
    padding-top: 0.5rem;
  }
  
  @media (max-width: 640px) {
    .profile-details {
      margin-left: 0;
      margin-top: 70px;
    }
  }
  
  .profile-details h1 {
    font-size: 1.8rem;
    font-weight: 700;
    margin: 0 0 0.25rem;
  }
  
  .profile-nip05 {
    font-size: 0.9rem;
    color: #666;
    margin-bottom: 0.5rem;
  }
  
  :global(.dark) .profile-nip05 {
    color: #aaa;
  }
  
  .profile-pubkey {
    font-size: 0.9rem;
    color: #666;
    margin-bottom: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  :global(.dark) .profile-pubkey {
    color: #aaa;
  }
  
  .pubkey-label {
    font-weight: 500;
  }
  
  .pubkey-value {
    font-family: monospace;
    background-color: #f5f5f5;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.85rem;
  }
  
  :global(.dark) .pubkey-value {
    background-color: #333;
  }
  
  .profile-bio {
    margin: 0.75rem 0;
    white-space: pre-line;
    font-size: 0.95rem;
    line-height: 1.5;
  }
  
  .profile-stats {
    display: flex;
    gap: 2rem;
    margin: 1.25rem 0;
  }
  
  .stat {
    display: flex;
    flex-direction: column;
  }
  
  .stat-count {
    font-weight: 700;
    font-size: 1.1rem;
  }
  
  .stat-label {
    font-size: 0.9rem;
    color: #666;
  }
  
  :global(.dark) .stat-label {
    color: #aaa;
  }
  
  .profile-actions {
    margin-top: 1rem;
  }
  
  .edit-profile-btn, .follow-btn {
    padding: 0.5rem 1.5rem;
    border-radius: 9999px;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.9rem;
  }
  
  .edit-profile-btn {
    background-color: transparent;
    border: 1px solid var(--nodus-blue);
    color: var(--nodus-blue);
  }
  
  .edit-profile-btn:hover {
    background-color: rgba(20, 92, 232, 0.1);
  }
  
  .follow-btn {
    background-color: var(--nodus-blue);
    color: white;
    border: none;
  }
  
  .follow-btn:hover {
    background-color: #0d47a1;
  }
  
  .follow-btn.following {
    background-color: #4CAF50;
  }
  
  .edit-profile-form {
    background-color: white;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  :global(.dark) .edit-profile-form {
    background-color: #1e1e1e;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
  
  .edit-profile-form h2 {
    font-size: 1.2rem;
    font-weight: 600;
    margin: 0 0 1.5rem;
    color: var(--nodus-blue);
  }
  
  .form-group {
    margin-bottom: 1rem;
  }
  
  .form-group label {
    display: block;
    font-weight: 500;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
  }
  
  .form-group input, .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.95rem;
    font-family: inherit;
  }
  
  :global(.dark) .form-group input, 
  :global(.dark) .form-group textarea {
    background-color: #333;
    border-color: #444;
    color: #eee;
  }
  
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 1.5rem;
  }
  
  .cancel-btn {
    padding: 0.5rem 1.25rem;
    background-color: transparent;
    border: 1px solid #ddd;
    border-radius: 9999px;
    font-weight: 500;
    cursor: pointer;
    font-size: 0.9rem;
  }
  
  :global(.dark) .cancel-btn {
    border-color: #444;
    color: #eee;
  }
  
  .save-btn {
    padding: 0.5rem 1.25rem;
    background-color: var(--nodus-blue);
    color: white;
    border: none;
    border-radius: 9999px;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.9rem;
  }
  
  .save-btn:hover:not(:disabled) {
    background-color: #0d47a1;
  }
  
  .save-btn:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
  
  :global(.dark) .save-btn:disabled {
    background-color: #555;
  }
  
  .profile-posts {
    margin-top: 2rem;
  }
  
  .profile-posts h2 {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: J.5rem;
    color: var(--nodus-blue);
  }
  
  .loading-notes, .empty-posts {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem 0;
    text-align: center;
    color: #666;
  }
  
  :global(.dark) .loading-notes, 
  :global(.dark) .empty-posts {
    color: #aaa;
  }
  
  .loading-notes .spinner {
    margin-bottom: 0.75rem;
  }
</style>