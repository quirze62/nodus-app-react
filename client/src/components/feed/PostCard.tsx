import { useState, useEffect } from 'react';
import { useNostr } from '@/hooks/useNostr';
import { formatDate } from '@/lib/utils';
import { NostrEvent, NostrProfile } from '@/lib/nostr';

interface PostCardProps {
  post: NostrEvent;
}

export default function PostCard({ post }: PostCardProps) {
  const { getProfile } = useNostr();
  const [profile, setProfile] = useState<NostrProfile & { pubkey: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [commentCount, setCommentCount] = useState(Math.floor(Math.random() * 30)); // Simulated for demo
  const [repostCount, setRepostCount] = useState(Math.floor(Math.random() * 50)); // Simulated for demo
  const [likeCount, setLikeCount] = useState(Math.floor(Math.random() * 100)); // Simulated for demo
  
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const userProfile = await getProfile(post.pubkey);
        setProfile(userProfile);
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadProfile();
  }, [post.pubkey, getProfile]);
  
  const handleComment = () => {
    setCommentCount(prev => prev + 1);
  };
  
  const handleRepost = () => {
    setRepostCount(prev => prev + 1);
  };
  
  const handleLike = () => {
    setLikeCount(prev => prev + 1);
  };
  
  const handleShare = () => {
    // Copy a link to this post to clipboard
    navigator.clipboard.writeText(`https://example.com/post/${post.id}`).then(() => {
      alert('Link copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy link:', err);
    });
  };
  
  // Check if the post has an image tag
  const imageUrl = post.tags?.find(tag => tag[0] === 'image')?.[1];
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex space-x-3">
          <img 
            className="h-10 w-10 rounded-full" 
            src={profile?.picture || `https://randomuser.me/api/portraits/${Math.random() > 0.5 ? 'women' : 'men'}/${Math.floor(Math.random() * 100)}.jpg`} 
            alt="User avatar" 
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                <span>{profile?.name || `User ${post.pubkey.substring(0, 6)}`}</span>
              </p>
              <span className="text-sm text-gray-500 dark:text-gray-400">·</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">{formatDate(post.created_at)}</span>
            </div>
            <p className="mt-1 text-sm text-gray-900 dark:text-white">
              {post.content}
            </p>
            
            {imageUrl && (
              <div className="mt-2 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                <img src={imageUrl} alt="Post attachment" className="w-full h-auto object-cover" />
              </div>
            )}
            
            <div className="mt-3 flex items-center space-x-4">
              <button 
                type="button" 
                className="flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary-light"
                onClick={handleComment}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 mr-1">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
                </svg>
                <span>{commentCount}</span>
              </button>
              <button 
                type="button" 
                className="flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary-light"
                onClick={handleRepost}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 mr-1">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
                </svg>
                <span>{repostCount}</span>
              </button>
              <button 
                type="button" 
                className="flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary-light"
                onClick={handleLike}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 mr-1">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
                <span>{likeCount}</span>
              </button>
              <button 
                type="button" 
                className="flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary-light"
                onClick={handleShare}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 mr-1">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                </svg>
                Share
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
