import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOffline } from '@/hooks/useOffline';
import { db } from '@/lib/db';
import RelaySettings from '@/components/settings/RelaySettings';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Moon, 
  Sun, 
  Monitor, 
  LogOut, 
  RefreshCw, 
  Shield, 
  Database, 
  Trash2, 
  Settings2, 
  Smartphone, 
  UserCog, 
  PaintBucket, 
  EyeOff,
  Router
} from 'lucide-react';

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { logout } = useAuth();
  const { isOffline, lastSynced, syncWhenOnline } = useOffline();
  const { toast } = useToast();
  
  const [notifications, setNotifications] = useState(true);
  const [encryptAllMessages, setEncryptAllMessages] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  
  const handleClearCache = async () => {
    if (!confirm('Are you sure you want to clear the local cache? This will delete all cached posts, profiles, and messages. Your keys will not be affected.')) return;
    
    setIsClearing(true);
    try {
      await db.clearCache();
      toast({
        title: 'Cache cleared',
        description: 'All cached data has been deleted successfully',
      });
    } catch (error) {
      console.error('Error clearing cache:', error);
      toast({
        title: 'Error',
        description: 'Failed to clear cache',
        variant: 'destructive',
      });
    } finally {
      setIsClearing(false);
    }
  };
  
  const handleSync = async () => {
    await syncWhenOnline();
  };
  
  const handleLogout = () => {
    if (confirm('Are you sure you want to log out?')) {
      logout();
    }
  };
  
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      
      <Tabs defaultValue="appearance">
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="appearance">
            <PaintBucket className="h-4 w-4 mr-2" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="privacy">
            <Shield className="h-4 w-4 mr-2" />
            Privacy
          </TabsTrigger>
          <TabsTrigger value="data">
            <Database className="h-4 w-4 mr-2" />
            Data & Sync
          </TabsTrigger>
          <TabsTrigger value="account">
            <UserCog className="h-4 w-4 mr-2" />
            Account
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customize how Nodus-App looks and feels
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <Select
                  value={theme}
                  onValueChange={(value) => setTheme(value as 'light' | 'dark' | 'system')}
                >
                  <SelectTrigger id="theme">
                    <SelectValue placeholder="Select a theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      <div className="flex items-center">
                        <Sun className="h-4 w-4 mr-2" />
                        Light
                      </div>
                    </SelectItem>
                    <SelectItem value="dark">
                      <div className="flex items-center">
                        <Moon className="h-4 w-4 mr-2" />
                        Dark
                      </div>
                    </SelectItem>
                    <SelectItem value="system">
                      <div className="flex items-center">
                        <Monitor className="h-4 w-4 mr-2" />
                        System
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Choose between light, dark, or system-based theme
                </p>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto-switch" className="text-base">Automatic Dark Mode</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Automatically switch between light and dark theme based on time of day
                  </p>
                </div>
                <Switch
                  id="auto-switch"
                  checked={theme === 'system'}
                  onCheckedChange={(checked) => setTheme(checked ? 'system' : 'light')}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="privacy">
          <Card>
            <CardHeader>
              <CardTitle>Privacy & Security</CardTitle>
              <CardDescription>
                Manage your privacy settings and secure your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="encrypt-messages" className="text-base">Encrypt All Messages</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Use NIP-04 encryption for all private messages
                  </p>
                </div>
                <Switch
                  id="encrypt-messages"
                  checked={encryptAllMessages}
                  onCheckedChange={setEncryptAllMessages}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notifications" className="text-base">Notification Alerts</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Receive notifications for new messages and mentions
                  </p>
                </div>
                <Switch
                  id="notifications"
                  checked={notifications}
                  onCheckedChange={setNotifications}
                />
              </div>
              
              <div>
                <Button variant="outline" className="w-full" onClick={() => toast({ title: "Feature not available", description: "This feature will be available in a future update" })}>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Manage Blocked Users
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="data">
          <Card>
            <CardHeader>
              <CardTitle>Data & Synchronization</CardTitle>
              <CardDescription>
                Manage local data and synchronization settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-base">Last Synchronized</Label>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleSync}
                    disabled={isOffline}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync Now
                  </Button>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {lastSynced 
                    ? `Last synced: ${lastSynced.toLocaleString()}` 
                    : 'Not synchronized yet'}
                </p>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto-sync" className="text-base">Auto Synchronization</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Automatically sync data when coming back online
                  </p>
                </div>
                <Switch
                  id="auto-sync"
                  checked={autoSync}
                  onCheckedChange={setAutoSync}
                />
              </div>
              
              <div>
                <Button 
                  variant="outline" 
                  className="w-full text-amber-600 border-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                  onClick={handleClearCache}
                  disabled={isClearing}
                >
                  {isClearing ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  {isClearing ? 'Clearing...' : 'Clear Local Cache'}
                </Button>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                  This will delete all cached posts, profiles, and messages. Your keys will not be affected.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Account Management</CardTitle>
              <CardDescription>
                Manage your account and session
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-base">Device Information</Label>
                <div className="flex items-center mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
                  <Smartphone className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                  <div>
                    <p className="text-sm font-medium">{navigator.userAgent.indexOf('Mobile') !== -1 ? 'Mobile Device' : 'Desktop'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {isOffline ? 'Offline' : 'Online'} • {navigator.platform}
                    </p>
                  </div>
                </div>
              </div>
              
              <div>
                <Label className="text-base">Application Version</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Nodus-App v1.0.0
                </p>
              </div>
              
              <div className="pt-4">
                <Button 
                  variant="destructive" 
                  className="w-full"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Log Out
                </Button>
              </div>
            </CardContent>
            <CardFooter className="flex justify-center border-t border-gray-200 dark:border-gray-800 pt-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Nodus-App • A secure and community-focused Nostr client
              </p>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
