import { useState, useEffect } from 'react';
import { useNostr } from '@/hooks/useNostr';
import { useOffline } from '@/hooks/useOffline';
import ComposePost from '@/components/feed/ComposePost';
import OfflineIndicator from '@/components/feed/OfflineIndicator';
import PostCard from '@/components/feed/PostCard';
import ProfileCard from '@/components/profile/ProfileCard';
import TrendingTopics from '@/components/widgets/TrendingTopics';
import SuggestedUsers from '@/components/widgets/SuggestedUsers';
import { NostrEvent } from '@/lib/nostr';
import { Skeleton } from '@/components/ui/skeleton';

export default function Home() {
  const { loadNotes, isLoading, error } = useNostr();
  const { isOffline } = useOffline();
  const [notes, setNotes] = useState<NostrEvent[]>([]);
  
  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const fetchedNotes = await loadNotes();
        setNotes(fetchedNotes);
      } catch (err) {
        console.error('Error fetching notes:', err);
      }
    };
    
    fetchNotes();
    
    // Set up a polling interval if online
    const interval = !isOffline ? setInterval(fetchNotes, 30000) : null;
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loadNotes, isOffline]);
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left column - Main feed */}
      <div className="lg:col-span-2 space-y-4">
        <ComposePost />
        
        {isOffline && <OfflineIndicator />}
        
        {isLoading && notes.length === 0 ? (
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
            <p className="text-sm mt-1">Please check your connection and try again.</p>
          </div>
        ) : notes.length === 0 ? (
          // Empty state
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden p-8 text-center">
            <h3 className="font-medium text-lg text-gray-900 dark:text-white">No posts yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              Start following people to see their posts in your feed, or create your first post!
            </p>
          </div>
        ) : (
          // Display posts
          notes.map(note => (
            <PostCard key={note.id} post={note} />
          ))
        )}
      </div>

      {/* Right column - Sidebar content */}
      <div className="hidden lg:block space-y-6">
        <ProfileCard />
        <TrendingTopics />
        <SuggestedUsers />
      </div>
    </div>
  );
}
