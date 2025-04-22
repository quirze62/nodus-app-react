import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface SuggestedUser {
  id: string;
  name: string;
  username: string;
  avatar: string;
}

const suggestedUsers: SuggestedUser[] = [
  {
    id: '1',
    name: 'Emma Wilson',
    username: 'emmawilson',
    avatar: 'https://randomuser.me/api/portraits/women/68.jpg'
  },
  {
    id: '2',
    name: 'David Kim',
    username: 'davidkim',
    avatar: 'https://randomuser.me/api/portraits/men/45.jpg'
  },
  {
    id: '3',
    name: 'Olivia Brown',
    username: 'oliviabrown',
    avatar: 'https://randomuser.me/api/portraits/women/22.jpg'
  }
];

export default function SuggestedUsers() {
  const [followedUsers, setFollowedUsers] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  
  const handleFollow = (userId: string) => {
    if (followedUsers.includes(userId)) {
      setFollowedUsers(followedUsers.filter(id => id !== userId));
    } else {
      setFollowedUsers([...followedUsers, userId]);
    }
  };
  
  const displayedUsers = showAll ? suggestedUsers : suggestedUsers.slice(0, 3);
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
      <div className="p-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Who to Follow</h3>
        <div className="space-y-4">
          {displayedUsers.map(user => (
            <div key={user.id} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <img 
                  className="h-10 w-10 rounded-full" 
                  src={user.avatar} 
                  alt={`${user.name}'s avatar`} 
                />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">@{user.username}</p>
                </div>
              </div>
              <Button
                variant={followedUsers.includes(user.id) ? "default" : "outline"} 
                size="sm"
                className={`px-3 py-1 text-xs font-medium ${
                  followedUsers.includes(user.id) 
                    ? 'bg-[#145ce8] text-white'
                    : 'text-[#145ce8] border border-[#145ce8] hover:bg-[#145ce8] hover:text-white'
                } rounded-full transition-colors`}
                onClick={() => handleFollow(user.id)}
              >
                {followedUsers.includes(user.id) ? 'Following' : 'Follow'}
              </Button>
            </div>
          ))}
          
          <Button
            variant="link"
            className="w-full text-sm text-[#145ce8] hover:underline"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? 'Show less' : 'Show more'}
          </Button>
        </div>
      </div>
    </div>
  );
}
