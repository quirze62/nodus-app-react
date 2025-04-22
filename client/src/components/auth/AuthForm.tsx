import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

export default function AuthForm() {
  const { login, generateNewKeys, isLoading } = useAuth();
  const { isDarkMode } = useTheme();
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  
  const handleLogin = async () => {
    if (!keyInput.trim()) return;
    await login(keyInput);
  };
  
  const handleGenerateNewKeys = async () => {
    await generateNewKeys();
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden p-6">
        <div className="text-center">
          <div className="flex justify-center">
            <div className="text-primary dark:text-primary-light text-4xl font-bold">Nodus</div>
            <div className="text-gray-700 dark:text-gray-300 text-4xl font-normal">App</div>
          </div>
          <h2 className="mt-6 text-2xl font-semibold text-gray-900 dark:text-white">Welcome to Nodus-App</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">A secure and community-focused Nostr client</p>
        </div>
        
        <div className="mt-8 space-y-6">
          <div>
            <Label htmlFor="key-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Your Private Key
            </Label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <Input
                id="key-input"
                name="key"
                type={showKey ? "text" : "password"}
                className="block w-full pr-10 py-3 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="nsec1..."
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Your key is stored locally and never sent to any server</p>
          </div>
          
          <div>
            <Button
              type="button"
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              onClick={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </Button>
          </div>
          
          <div className="text-center">
            <span className="text-sm text-gray-500 dark:text-gray-400">Don't have a key?</span>
            <Button
              type="button"
              variant="link"
              className="ml-1 text-sm text-primary dark:text-primary-light hover:text-primary-dark dark:hover:text-primary-light focus:outline-none"
              onClick={handleGenerateNewKeys}
              disabled={isLoading}
            >
              Generate a new key
            </Button>
          </div>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full border-t border-gray-300 dark:border-gray-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">Or continue with</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            <Button
              type="button"
              variant="outline"
              className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm bg-white dark:bg-gray-900 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 mr-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
              Connect using Extension
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
