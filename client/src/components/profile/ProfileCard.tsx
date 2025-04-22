import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { formatPubkey } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export default function ProfileCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [followers, setFollowers] = useState(Math.floor(Math.random() * 300) + 100); // Simulated for demo
  const [following, setFollowing] = useState(Math.floor(Math.random() * 200) + 100); // Simulated for demo
  const [posts, setPosts] = useState(Math.floor(Math.random() * 100) + 10); // Simulated for demo
  
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: "Public key copied to clipboard",
      });
    } catch (err) {
      console.error('Failed to copy text: ', err);
      toast({
        title: "Error",
        description: "Failed to copy text to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-center mb-4">
          <img 
            className="h-12 w-12 rounded-full" 
            src="https://randomuser.me/api/portraits/men/32.jpg" 
            alt="User avatar" 
          />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              {user?.publicKey ? `User ${user.publicKey.substring(0, 6)}` : 'John Doe'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              @{user?.publicKey ? user.publicKey.substring(0, 8) : 'johndoe'}
            </p>
          </div>
        </div>
        <div className="text-sm text-gray-900 dark:text-white">
          <div className="mb-3">
            <div className="flex justify-between mb-1">
              <span>Public Key</span>
              <Button 
                variant="ghost" 
                className="text-primary dark:text-primary-light text-xs h-auto p-0"
                onClick={() => copyToClipboard(user?.publicKey || '')}
              >
                Copy
              </Button>
            </div>
            <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded-md overflow-hidden">
              <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                {user?.npub || 'npub1ab7ekw5n634jzfpzmuya5w3aes57hpct9j54wfpksw65s68ky5xqvt8as6'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
          <div>
            <span className="font-medium text-sm text-gray-900 dark:text-white">{following}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">Following</span>
          </div>
          <div>
            <span className="font-medium text-sm text-gray-900 dark:text-white">{followers}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">Followers</span>
          </div>
          <div>
            <span className="font-medium text-sm text-gray-900 dark:text-white">{posts}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">Posts</span>
          </div>
        </div>
      </div>
    </div>
  );
}
