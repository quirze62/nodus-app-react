import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/db';
import { importKeyFromNsec, NostrUser } from '@/lib/nostr';
import { loginWithPrivateKey, generateNewUser } from '@/lib/ndk';

interface AuthContextType {
  user: NostrUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (nsecOrPrivKey: string) => Promise<boolean>;
  generateNewKeys: () => Promise<NostrUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => false,
  generateNewKeys: async () => ({ publicKey: '', npub: '', privateKey: '', nsec: '' }),
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<NostrUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Check if user is already logged in
  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = await db.getCurrentUser();
        if (storedUser) {
          setUser(storedUser);
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
  }, [toast]);

  // Login with nsec or private key using NDK
  const login = async (nsecOrPrivKey: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      // Handle nsec format
      let privateKey = nsecOrPrivKey;
      if (nsecOrPrivKey.startsWith('nsec')) {
        const importedUser = importKeyFromNsec(nsecOrPrivKey);
        if (!importedUser || !importedUser.privateKey) {
          toast({
            title: 'Invalid Key',
            description: 'The provided nsec key is not valid.',
            variant: 'destructive'
          });
          return false;
        }
        privateKey = importedUser.privateKey;
      }
      
      // Use NDK to login with private key
      const loggedInUser = await loginWithPrivateKey(privateKey);
      
      if (!loggedInUser) {
        toast({
          title: 'Login Failed',
          description: 'Failed to authenticate with the provided key.',
          variant: 'destructive'
        });
        return false;
      }
      
      // Set user in state
      setUser(loggedInUser);
      
      toast({
        title: 'Success',
        description: 'Logged in successfully!'
      });
      
      return true;
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: 'Login Failed',
        description: 'An error occurred during login.',
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Generate new keys using NDK
  const generateNewKeys = async (): Promise<NostrUser> => {
    try {
      setIsLoading(true);
      
      // Generate new key pair using NDK
      const newUser = await generateNewUser();
      
      if (!newUser) {
        throw new Error('Failed to generate new user');
      }
      
      // Set user in state
      setUser(newUser);
      
      toast({
        title: 'Keys Generated',
        description: 'New keys have been generated successfully!'
      });
      
      return newUser;
    } catch (error) {
      console.error('Error generating keys:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate new keys.',
        variant: 'destructive'
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout
  const logout = () => {
    // Clear user data from state
    setUser(null);
    
    // Clear database
    db.user.clear().then(() => {
      toast({
        title: 'Logged Out',
        description: 'You have been logged out successfully.'
      });
    }).catch(error => {
      console.error('Error during logout:', error);
      toast({
        title: 'Error',
        description: 'An error occurred during logout.',
        variant: 'destructive'
      });
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        generateNewKeys,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};