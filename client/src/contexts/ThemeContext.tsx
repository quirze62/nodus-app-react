import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '@/lib/db';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDarkMode: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'system',
  setTheme: () => {},
  isDarkMode: false,
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('system');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Initialize theme from user settings or system preference
  useEffect(() => {
    const initializeTheme = async () => {
      try {
        // Check localStorage first for backward compatibility
        const storedTheme = localStorage.getItem('color-theme') as Theme | null;
        
        if (storedTheme) {
          setThemeState(storedTheme);
        } else {
          // If no theme in localStorage, check user settings in DB
          const darkModeEnabled = await db.getDarkMode();
          setThemeState(darkModeEnabled ? 'dark' : 'light');
        }
      } catch (error) {
        console.error('Error initializing theme:', error);
        // Fall back to system preference
        setThemeState('system');
      }
    };

    initializeTheme();
  }, []);

  // Update dark mode state based on theme
  useEffect(() => {
    const updateDarkMode = () => {
      const isDark = 
        theme === 'dark' || 
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      
      setIsDarkMode(isDark);
      
      // Update document class
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      
      // Also save to DB
      db.setDarkMode(isDark).catch(err => {
        console.error('Error saving dark mode setting:', err);
      });
    };

    updateDarkMode();

    // Add event listener for system preference changes
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', updateDarkMode);
      return () => mediaQuery.removeEventListener('change', updateDarkMode);
    }
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    
    // Also save to localStorage for backward compatibility
    if (newTheme === 'system') {
      localStorage.removeItem('color-theme');
    } else {
      localStorage.setItem('color-theme', newTheme);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};
