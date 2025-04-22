import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/db';
import { generateKeyPair, importKeyFromNsec, NostrUser } from '@/lib/nostr';
import { apiRequest } from '@/lib/queryClient';

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

  // Login with nsec or private key
  const login = async (nsecOrPrivKey: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      let importedUser: NostrUser | null = null;
      
      // Try to import as nsec
      if (nsecOrPrivKey.startsWith('nsec')) {
        importedUser = importKeyFromNsec(nsecOrPrivKey);
      }
      
      // If not successful, try as raw private key (hex)
      if (!importedUser) {
        // This is just for demo, in a real app we would validate the hex format
        importedUser = {
          privateKey: nsecOrPrivKey,
          publicKey: 'placeholder', // In a real app, we would derive this
          npub: 'placeholder',
          nsec: 'placeholder',
        };
      }
      
      if (!importedUser) {
        toast({
          title: 'Invalid Key',
          description: 'The provided key is not valid.',
          variant: 'destructive'
        });
        return false;
      }
      
      // Store user in DB
      await db.storeCurrentUser(importedUser);
      setUser(importedUser);
      
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

  // Generate new keys
  const generateNewKeys = async (): Promise<NostrUser> => {
    try {
      setIsLoading(true);
      
      // Generate new key pair
      const newUser = generateKeyPair();
      
      // Store in database
      await db.storeCurrentUser(newUser);
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
