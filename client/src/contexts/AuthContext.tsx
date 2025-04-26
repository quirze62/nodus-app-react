import { createContext, useState, useEffect, useContext } from 'react';
import { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import type { NDK, NDKUser } from '@nostr-dev-kit/ndk';
import * as nostrTools from 'nostr-tools';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/db';

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
  login: (nsecOrPrivKey: string) => Promise<boolean>;
  generateNewKeys: () => Promise<NostrUser>;
  logout: () => void;
  ndk: NDK | null;
  error: string | null;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
  login: async () => false,
  generateNewKeys: async () => ({ publicKey: '', npub: '', privateKey: '', nsec: '' }),
  logout: () => {},
  ndk: null,
  error: null,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children, ndk }: { children: React.ReactNode; ndk: NDK }) => {
  const [user, setUser] = useState<NostrUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const savedKey = localStorage.getItem('nostr_private_key');
        if (savedKey && ndk) {
          // Convert NDK user to NostrUser format
          const signer = new NDKPrivateKeySigner(savedKey);
          ndk.signer = signer;
          const ndkUser = await signer.user();
          
          if (ndkUser) {
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
            console.log('Logged in user:', nostrUser);
          }
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
      if (!ndk) throw new Error('NDK not initialized');
      setIsLoading(true);
      
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
      
      // Use NDK implementation to login with private key
      const signer = new NDKPrivateKeySigner(privateKey);
      ndk.signer = signer;
      const ndkUser = await signer.user();
      
      if (!ndkUser) {
        throw new Error('Failed to login with provided key');
      }
      
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
      if (!ndk) throw new Error('NDK not initialized');
      setIsLoading(true);
      
      // Generate new key pair using nostr-tools
      const privateKey = nostrTools.generatePrivateKey();
      const publicKey = nostrTools.getPublicKey(privateKey);
      const npub = nostrTools.nip19.npubEncode(publicKey);
      const nsec = nostrTools.nip19.nsecEncode(privateKey);
      
      const signer = new NDKPrivateKeySigner(privateKey);
      ndk.signer = signer;
      
      // Create NostrUser object
      const newUser: NostrUser = {
        publicKey: publicKey,
        npub: npub,
        privateKey: privateKey,
        nsec: nsec,
      };
      
      // Set user in state
      setUser(newUser);
      localStorage.setItem('nostr_private_key', privateKey);
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

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
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