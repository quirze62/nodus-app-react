import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useHybridNostr } from '@/hooks/useHybridNostr';
import { formatDate } from '@/lib/utils';
import { NostrEvent, NostrProfile, EventKind } from '@/lib/nostr';
import logger from '@/lib/logger';

interface PostCardProps {
  post: NostrEvent;
  onReply?: (post: NostrEvent) => void;
}

export default function PostCard({ post, onReply }: PostCardProps) {
  const { user } = useAuth();
  const { getProfile, createReaction, repostNote, getReactions, getReposts, getReplies } = useHybridNostr();
  
  // State
  const [profile, setProfile] = useState<NostrProfile & { pubkey: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [commentCount, setCommentCount] = useState(0);
  const [repostCount, setRepostCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [hasReposted, setHasReposted] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState<{like: boolean, repost: boolean, reply: boolean}>({
    like: false,
    repost: false,
    reply: false
  });
  
  // Load profile and interaction counts
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load author profile
        const userProfile = await getProfile(post.pubkey);
        setProfile(userProfile || null);
        
        // Load interactions
        const [reactions, reposts, replies] = await Promise.all([
          getReactions(post.id),
          getReposts(post.id),
          getReplies(post.id)
        ]);
        
        // Set counters
        setLikeCount(reactions.length);
        setRepostCount(reposts.length);
        setCommentCount(replies.length);
        
        // Check if current user has liked or reposted
        if (user) {
          const userLiked = reactions.some(r => r.pubkey === user.publicKey);
          const userReposted = reposts.some(r => r.pubkey === user.publicKey);
          setHasLiked(userLiked);
          setHasReposted(userReposted);
        }
      } catch (error) {
        console.error('Error loading post data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [post.id, post.pubkey, getProfile, getReactions, getReposts, getReplies, user]);
  
  // Handle like
  const handleLike = async () => {
    if (!user) {
      alert('Please log in to like posts');
      return;
    }
    
    setIsActionLoading(prev => ({ ...prev, like: true }));
    
    try {
      // If already liked, we would implement unlike functionality here
      // For now, we'll just ignore repeat likes
      if (hasLiked) {
        return;
      }
      
      // Create a reaction (like)
      const reaction = await createReaction(post.id, '+');
      
      if (reaction) {
        setLikeCount(prev => prev + 1);
        setHasLiked(true);
        logger.info(`Successfully liked post: ${post.id}`);
      } else {
        logger.error('Failed to create reaction - no reaction event returned');
        alert('Could not like post. Please check your connection.');
      }
    } catch (error) {
      logger.error('Error liking post:', error);
      alert('Error liking post. Please try again later.');
    } finally {
      setIsActionLoading(prev => ({ ...prev, like: false }));
    }
  };
  
  // Handle repost
  const handleRepost = async () => {
    if (!user) {
      alert('Please log in to repost');
      return;
    }
    
    setIsActionLoading(prev => ({ ...prev, repost: true }));
    
    try {
      // If already reposted, we would implement undo functionality here
      // For now, we'll just ignore repeat reposts
      if (hasReposted) {
        return;
      }
      
      // Create a repost
      const repost = await repostNote(post.id, post.pubkey);
      
      if (repost) {
        setRepostCount(prev => prev + 1);
        setHasReposted(true);
        logger.info(`Successfully reposted: ${post.id}`);
      } else {
        logger.error('Failed to create repost - no event returned');
        alert('Could not repost. Please check your connection.');
      }
    } catch (error) {
      logger.error('Error reposting:', error);
      alert('Error reposting. Please try again later.');
    } finally {
      setIsActionLoading(prev => ({ ...prev, repost: false }));
    }
  };
  
  // Handle comment
  const handleComment = () => {
    if (!user) {
      alert('Please log in to comment');
      return;
    }
    
    // If onReply function is provided, use it (for thread view)
    if (onReply) {
      onReply(post);
    } else {
      // Otherwise toggle the inline reply form
      setShowReplyForm(!showReplyForm);
    }
  };
  
  // Handle share
  const handleShare = () => {
    // Copy a link to this post to clipboard
    const url = `nostr:${post.id}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('Nostr link copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy link:', err);
    });
  };
  
  // Check if the post has an image tag
  const imageUrl = post.tags?.find(tag => tag[0] === 'image')?.[1];
  
  // Check if the post is a reply
  const isReply = post.tags?.some(tag => tag[0] === 'e' && tag[3] === 'reply');
  const replyToId = post.tags?.find(tag => tag[0] === 'e' && tag[3] === 'reply')?.[1];
  
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden 
                    ${isReply ? 'border-l-4 border-primary' : ''}`}>
      <div className="p-4">
        {isReply && (
          <div className="mb-2 text-xs text-gray-500 dark:text-gray-400">
            Replying to post {replyToId?.substring(0, 10)}...
          </div>
        )}
        <div className="flex space-x-3">
          <img 
            className="h-10 w-10 rounded-full" 
            src={profile?.picture || `https://avatar.vercel.sh/${post.pubkey.substring(0, 8)}`} 
            alt="User avatar" 
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                <span>{profile?.name || `User ${post.pubkey.substring(0, 6)}`}</span>
                {profile?.nip05 && (
                  <span className="ml-1 text-primary text-xs">✓</span>
                )}
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
                className={`flex items-center text-sm ${
                  showReplyForm 
                    ? 'text-primary dark:text-primary-light' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary-light'
                }`}
                onClick={handleComment}
                disabled={isActionLoading.reply}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 mr-1">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
                </svg>
                <span>{commentCount}</span>
              </button>
              <button 
                type="button" 
                className={`flex items-center text-sm ${
                  hasReposted 
                    ? 'text-green-500 dark:text-green-400' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-green-500 dark:hover:text-green-400'
                }`}
                onClick={handleRepost}
                disabled={isActionLoading.repost || hasReposted}
              >
                {isActionLoading.repost ? (
                  <svg className="animate-spin h-5 w-5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill={hasReposted ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 mr-1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
                  </svg>
                )}
                <span>{repostCount}</span>
              </button>
              <button 
                type="button" 
                className={`flex items-center text-sm ${
                  hasLiked 
                    ? 'text-red-500 dark:text-red-400' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400'
                }`}
                onClick={handleLike}
                disabled={isActionLoading.like || hasLiked}
              >
                {isActionLoading.like ? (
                  <svg className="animate-spin h-5 w-5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill={hasLiked ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 mr-1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                )}
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
            
            {/* Reply form would go here - we'll implement this as a separate component later */}
          </div>
        </div>
      </div>
    </div>
  );
}
