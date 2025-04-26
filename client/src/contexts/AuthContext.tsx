import { createContext, useState, useEffect, useContext } from 'react';
import NDK, { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import type { NDKUser } from '@nostr-dev-kit/ndk';
import * as nostrTools from 'nostr-tools';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/db';
import { useNdk } from '@/contexts/NdkContext';

// Define the NostrUser interface if it's not imported
interface NostrUser {
  publicKey: string;
  npub: string;
  privateKey: string;
  nsec: string;
}

interface AuthContextType {
  user: NostrUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (nsecOrPrivKey: string) => Promise<boolean>;
  generateNewKeys: () => Promise<NostrUser>;
  logout: () => void;
  ndk: NDK | null;
  error: string | null;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
  isAuthenticated: false,
  login: async () => false,
  generateNewKeys: async () => ({ publicKey: '', npub: '', privateKey: '', nsec: '' }),
  logout: () => {},
  ndk: null,
  error: null,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { ndk } = useNdk();
  const [user, setUser] = useState<NostrUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const savedKey = localStorage.getItem('nostr_private_key');
        if (!savedKey) {
          setIsLoading(false);
          return;
        }
        
        // Wait for NDK to be initialized if needed
        if (!ndk) {
          console.log('Waiting for NDK initialization in loadUser...');
          let attempts = 0;
          const maxAttempts = 10;
          
          while (!ndk && attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 500)); // Wait 500ms between checks
            attempts++;
          }
          
          if (!ndk) {
            console.warn('NDK initialization timed out in loadUser');
            setIsLoading(false);
            return;
          }
          
          console.log('NDK initialized after waiting in loadUser');
        }
        
        // Now that we have both a saved key and an initialized NDK
        console.log('Creating signer with saved key');
        // Convert NDK user to NostrUser format
        const signer = new NDKPrivateKeySigner(savedKey);
        ndk.signer = signer;
        const ndkUser = await signer.user();
        
        if (ndkUser) {
          console.log('Successfully loaded user from saved key');
          // Generate nsec from private key
          const nsec = nostrTools.nip19.nsecEncode(savedKey);
          
          const nostrUser: NostrUser = {
            publicKey: ndkUser.pubkey,
            npub: ndkUser.npub || nostrTools.nip19.npubEncode(ndkUser.pubkey),
            privateKey: savedKey,
            nsec: nsec,
          };
          
          setUser(nostrUser);
          setError(null);
          console.log('Logged in user:', ndkUser.pubkey);
        }
      } catch (error) {
        console.error('Error loading user:', error);
        toast({
          title: 'Error',
          description: 'Failed to load user data.',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, [toast, ndk]);

  // Login with nsec or private key using NDK implementation
  const login = async (nsecOrPrivKey: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      // Check if NDK is initialized, if not, wait for initialization
      if (!ndk) {
        console.log('Waiting for NDK initialization...');
        let attempts = 0;
        const maxAttempts = 10;
        
        while (!ndk && attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, 500)); // Wait 500ms between checks
          attempts++;
        }
        
        if (!ndk) {
          throw new Error('NDK initialization timed out');
        }
        
        console.log('NDK initialized after waiting.');
      }
      
      // Convert nsec to hex private key if needed
      let privateKey = nsecOrPrivKey;
      let nsec = nsecOrPrivKey;
      
      if (nsecOrPrivKey.startsWith('nsec')) {
        try {
          const decoded = nostrTools.nip19.decode(nsecOrPrivKey);
          if (decoded.type === 'nsec') {
            privateKey = decoded.data as string;
          }
        } catch (decodeErr) {
          throw new Error('Invalid nsec format');
        }
      } else {
        // Generate nsec if provided with hex private key
        nsec = nostrTools.nip19.nsecEncode(privateKey);
      }
      
      console.log('Creating signer with provided key');
      // Use NDK implementation to login with private key
      const signer = new NDKPrivateKeySigner(privateKey);
      ndk.signer = signer;
      
      console.log('Getting user from signer');
      const ndkUser = await signer.user();
      
      if (!ndkUser) {
        throw new Error('Failed to login with provided key');
      }
      
      console.log('Successfully retrieved user pubkey:', ndkUser.pubkey);
      
      // Convert NDK user to NostrUser format
      const loggedInUser: NostrUser = {
        publicKey: ndkUser.pubkey,
        npub: ndkUser.npub || nostrTools.nip19.npubEncode(ndkUser.pubkey),
        privateKey: privateKey,
        nsec: nsec,
      };
      
      // Set user in state
      setUser(loggedInUser);
      localStorage.setItem('nostr_private_key', privateKey);
      setError(null);
      
      toast({
        title: 'Login Successful',
        description: 'You are now logged in.',
      });
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Login failed: ${errorMessage}`);
      console.error('Login error:', err);
      toast({
        title: 'Login Failed',
        description: errorMessage || 'Invalid private key or nsec.',
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const generateNewKeys = async (): Promise<NostrUser> => {
    try {
      setIsLoading(true);
      
      // Check if NDK is initialized, if not, wait for initialization
      if (!ndk) {
        console.log('Waiting for NDK initialization...');
        let attempts = 0;
        const maxAttempts = 10;
        
        while (!ndk && attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, 500)); // Wait 500ms between checks
          attempts++;
        }
        
        if (!ndk) {
          throw new Error('NDK initialization timed out');
        }
        
        console.log('NDK initialized after waiting.');
      }
      
      // Generate new key pair using crypto API
      const privateKeyBytes = window.crypto.getRandomValues(new Uint8Array(32));
      const privateKeyHex = Array.from(privateKeyBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      // Get public key using nostr-tools
      const publicKey = nostrTools.getPublicKey(privateKeyHex);
      const npub = nostrTools.nip19.npubEncode(publicKey);
      const nsec = nostrTools.nip19.nsecEncode(privateKeyHex);
      
      console.log('Generated new keys successfully');
      
      const signer = new NDKPrivateKeySigner(privateKeyHex);
      ndk.signer = signer;
      
      // Create NostrUser object
      const newUser: NostrUser = {
        publicKey: publicKey,
        npub: npub,
        privateKey: privateKeyHex,
        nsec: nsec,
      };
      
      // Set user in state
      setUser(newUser);
      localStorage.setItem('nostr_private_key', privateKeyHex);
      setError(null);
      
      toast({
        title: 'Keys Generated',
        description: 'New keys have been generated and you are now logged in.',
      });
      
      return newUser;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Failed to generate keys: ${errorMessage}`);
      console.error('Key generation error:', err);
      toast({
        title: 'Error',
        description: 'Failed to generate new keys.',
        variant: 'destructive'
      });
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    // Clear user data from state
    setUser(null);
    localStorage.removeItem('nostr_private_key');
    
    // Clear database
    try {
      // Clear the current user from the database
      db.clearCurrentUser();
      // Optional: Also clear the cache if needed
      db.clearCache();
    } catch (err) {
      console.error('Error clearing user data:', err);
    }
    
    toast({
      title: 'Logged Out',
      description: 'You have been logged out successfully.',
    });
  };

  // Derive authentication state from user
  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        login,
        generateNewKeys,
        logout,
        ndk,
        error
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};