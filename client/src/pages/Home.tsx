import { useState } from 'react';
import { useNodusPosts } from '@/hooks/useNodusPosts';
import { useOffline } from '@/hooks/useOffline';
import ComposePost from '@/components/feed/ComposePost';
import OfflineIndicator from '@/components/feed/OfflineIndicator';
import PostCard from '@/components/feed/PostCard';
import ProfileCard from '@/components/profile/ProfileCard';
import TrendingTopics from '@/components/widgets/TrendingTopics';
import SuggestedUsers from '@/components/widgets/SuggestedUsers';
import { Skeleton } from '@/components/ui/skeleton';
import { FilterMode } from '@/components/feed/FeedFilters';

export default function Home() {
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const { posts, isLoading, error, createPost } = useNodusPosts(filterMode);
  const { isOffline } = useOffline();
  
  // Handle filter mode changes
  const handleFilterChange = (newMode: FilterMode) => {
    setFilterMode(newMode);
  };
  
  // Display only authentic data from Nostr relays
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
      {/* Left column - Main feed */}
      <div className="lg:col-span-2 space-y-4">
        <ComposePost onSubmit={createPost} />
        
        {/* Filter Mode Selector */}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 p-3 border-b border-gray-200 dark:border-gray-800 mb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Feed</h2>
            <select
              className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-sm font-medium"
              value={filterMode}
              onChange={(e) => handleFilterChange(e.target.value as FilterMode)}
            >
              <option value="all">All Posts</option>
              <option value="followers">From My Followers</option>
              <option value="follows">From Accounts I Follow</option>
              <option value="trending">Trending</option>
            </select>
          </div>
        </div>
        
        {isOffline && <OfflineIndicator />}
        
        {isLoading && posts.length === 0 ? (
          // Loading skeleton
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden p-4">
              <div className="flex space-x-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            </div>
          ))
        ) : error ? (
          // Error state
          <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-xl text-red-700 dark:text-red-300">
            <p className="font-medium">Error loading posts</p>
            <p className="text-sm mt-1">{error || "Please check your connection and try again."}</p>
          </div>
        ) : posts.length === 0 ? (
          // Empty state
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden p-8 text-center">
            <h3 className="font-medium text-lg text-gray-900 dark:text-white">No posts yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              {filterMode === 'all' 
                ? "Start following people to see their posts in your feed, or create your first post!"
                : filterMode === 'follows'
                ? "You aren't following anyone yet, or they haven't posted recently."
                : filterMode === 'followers'
                ? "You don't have any followers yet, or they haven't posted recently."
                : "No trending posts found at the moment."}
            </p>
          </div>
        ) : (
          // Display posts
          posts.map(post => (
            <PostCard key={post.id} post={post} />
          ))
        )}
      </div>

      {/* Right column - Sidebar content */}
      <div className="hidden lg:block space-y-6">
        <ProfileCard />
        <TrendingTopics />
        <SuggestedUsers />
      </div>
      
      {/* Floating Action Button (mobile only) */}
      <button 
        className="md:hidden fixed right-6 bottom-20 w-14 h-14 rounded-full bg-[#145ce8] text-white shadow-lg flex items-center justify-center z-20 hover:bg-[#0d4ab8] transition-colors"
        onClick={() => {
          // Scroll to compose post area
          window.scrollTo({ top: 0, behavior: 'smooth' });
          // Focus on compose textarea after a slight delay
          setTimeout(() => {
            const textarea = document.querySelector('textarea');
            if (textarea) textarea.focus();
          }, 500);
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>
    </div>
  );
}