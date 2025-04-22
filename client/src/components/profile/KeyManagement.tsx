import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { EyeIcon, EyeOffIcon, ClipboardCopyIcon, ShieldIcon, KeyIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function KeyManagement() {
  const { user, generateNewKeys } = useAuth();
  const { toast } = useToast();
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [backupComplete, setBackupComplete] = useState(false);
  
  const toggleShowPrivateKey = () => {
    if (!showPrivateKey) {
      // Warning before showing private key
      if (!confirm('Are you sure you want to show your private key? Anyone with access to this key can take control of your account.')) {
        return;
      }
    }
    setShowPrivateKey(!showPrivateKey);
  };
  
  const copyToClipboard = async (text: string, description: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${description} copied to clipboard`,
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
  
  const handleGenerateNewKeys = async () => {
    if (confirm('Are you sure you want to generate new keys? This will replace your current keys and you will lose access to your current account unless you have backed up your keys.')) {
      await generateNewKeys();
      toast({
        title: "Success",
        description: "New keys generated successfully!",
      });
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <KeyIcon className="w-5 h-5 mr-2" />
          Key Management
        </CardTitle>
        <CardDescription>
          Your cryptographic keys provide access to your account and encrypt your private messages.
          Never share your private key with anyone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="public-key">Public Key (npub)</Label>
          <div className="flex mt-1">
            <Input
              id="public-key"
              value={user?.npub || ''}
              readOnly
              className="font-mono text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              className="ml-2"
              onClick={() => copyToClipboard(user?.npub || '', 'Public key')}
            >
              <ClipboardCopyIcon className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            This is your public identifier on Nostr. You can share this with others.
          </p>
        </div>
        
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="private-key">Private Key (nsec)</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleShowPrivateKey}
              className="h-8 px-2 text-xs"
            >
              {showPrivateKey ? (
                <EyeOffIcon className="h-4 w-4 mr-1" />
              ) : (
                <EyeIcon className="h-4 w-4 mr-1" />
              )}
              {showPrivateKey ? 'Hide' : 'Show'}
            </Button>
          </div>
          <div className="flex mt-1">
            <Input
              id="private-key"
              type={showPrivateKey ? 'text' : 'password'}
              value={user?.nsec || ''}
              readOnly
              className="font-mono text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              className="ml-2"
              onClick={() => copyToClipboard(user?.nsec || '', 'Private key')}
            >
              <ClipboardCopyIcon className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center">
            <ShieldIcon className="h-3 w-3 text-amber-500 mr-1" />
            Keep this secret! Anyone with your private key can impersonate you.
          </p>
        </div>
        
        <div className="flex items-center space-x-2 pt-2">
          <Switch
            id="backup"
            checked={backupComplete}
            onCheckedChange={setBackupComplete}
          />
          <Label htmlFor="backup">
            I have backed up my private key in a safe place
          </Label>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={handleGenerateNewKeys}>
          Generate New Keys
        </Button>
        <Button
          variant="destructive"
          disabled={!backupComplete}
          onClick={() => toast({
            title: "Feature not available",
            description: "Deleting account data is not available in this version.",
          })}
        >
          Delete Account Data
        </Button>
      </CardFooter>
    </Card>
  );
}
