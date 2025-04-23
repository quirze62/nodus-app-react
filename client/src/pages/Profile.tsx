import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNostr } from '@/hooks/useNostr';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import PostCard from '@/components/feed/PostCard';
import ProfileCard from '@/components/profile/ProfileCard';
import KeyManagement from '@/components/profile/KeyManagement';
import { NostrEvent } from '@/lib/nostr';
import { Pencil, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Profile() {
  const { user } = useAuth();
  const { getNotesByUser, updateProfile, getProfile } = useNostr();
  const { toast } = useToast();
  
  const [userPosts, setUserPosts] = useState<NostrEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  
  const [profile, setProfile] = useState({
    name: '',
    about: '',
    picture: ''
  });
  
  const [editedProfile, setEditedProfile] = useState({
    name: '',
    about: '',
    picture: ''
  });
  
  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.publicKey) return;
      
      setIsLoading(true);
      try {
        // Load user profile
        const userProfile = await getProfile(user.publicKey);
        setProfile({
          name: userProfile.name || '',
          about: userProfile.about || '',
          picture: userProfile.picture || ''
        });
        setEditedProfile({
          name: userProfile.name || '',
          about: userProfile.about || '',
          picture: userProfile.picture || ''
        });
        
        // Load user posts
        const posts = await getNotesByUser(user.publicKey);
        setUserPosts(posts);
      } catch (error) {
        console.error('Error loading profile data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load profile data',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadProfile();
  }, [user, getProfile, getNotesByUser, toast]);
  
  const handleEditProfile = () => {
    setIsEditing(true);
  };
  
  const handleSaveProfile = async () => {
    try {
      const success = await updateProfile(editedProfile);
      if (success) {
        setProfile(editedProfile);
        setIsEditing(false);
        toast({
          title: 'Success',
          description: 'Profile updated successfully'
        });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive'
      });
    }
  };
  
  const handleCancelEdit = () => {
    setEditedProfile(profile);
    setIsEditing(false);
  };
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <ProfileCard />
        </div>
        
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Manage your public profile information
                </CardDescription>
              </div>
              {!isEditing ? (
                <Button variant="outline" size="sm" onClick={handleEditProfile}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveProfile}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Display Name</Label>
                    <Input
                      id="name"
                      value={editedProfile.name}
                      onChange={(e) => setEditedProfile({...editedProfile, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="about">About</Label>
                    <Textarea
                      id="about"
                      rows={4}
                      value={editedProfile.about}
                      onChange={(e) => setEditedProfile({...editedProfile, about: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="picture">Profile Picture URL</Label>
                    <Input
                      id="picture"
                      value={editedProfile.picture}
                      onChange={(e) => setEditedProfile({...editedProfile, picture: e.target.value})}
                      placeholder="https://example.com/avatar.jpg"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Display Name</h3>
                    <p className="mt-1">{profile.name || 'Not set'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">About</h3>
                    <p className="mt-1">{profile.about || 'No about information provided'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Profile Picture</h3>
                    {profile.picture ? (
                      <div className="mt-1">
                        <img 
                          src={profile.picture} 
                          alt="Profile" 
                          className="h-20 w-20 rounded-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = 'https://randomuser.me/api/portraits/men/32.jpg';
                          }}
                        />
                      </div>
                    ) : (
                      <p className="mt-1">No profile picture set</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="posts">My Posts</TabsTrigger>
          <TabsTrigger value="keys">Key Management</TabsTrigger>
          <TabsTrigger value="settings">Account Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="posts" className="space-y-4">
          {isLoading ? (
            // Loading state
            <div className="text-center p-8">
              <p>Loading posts...</p>
            </div>
          ) : userPosts.length === 0 ? (
            // Empty state
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
              <h3 className="font-medium text-lg">No posts yet</h3>
              <p className="text-gray-500 dark:text-gray-400 mt-2">
                When you create posts, they will appear here.
              </p>
              <Button className="mt-4">Create your first post</Button>
            </div>
          ) : (
            // Display posts
            userPosts.map(post => (
              <PostCard key={post.id} post={post} />
            ))
          )}
        </TabsContent>
        
        <TabsContent value="keys">
          <KeyManagement />
        </TabsContent>
        
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>
                Manage your account preferences and settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-center text-gray-500 dark:text-gray-400">
                Account settings will be available in future versions.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
