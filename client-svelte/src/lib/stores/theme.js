import { writable } from 'svelte/store';
import { db } from '../db/db';

// Possible theme values
const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
};

// Get initial theme from local storage if available
function getInitialTheme() {
  if (typeof window === 'undefined') return THEMES.LIGHT;
  
  try {
    const savedTheme = localStorage.getItem('nodus-theme');
    if (savedTheme && Object.values(THEMES).includes(savedTheme)) {
      return savedTheme;
    }
    
    // Default to system preference if available
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return THEMES.DARK;
    }
    
    return THEMES.LIGHT;
  } catch (e) {
    return THEMES.LIGHT;
  }
}

// Create theme store
function createThemeStore() {
  const { subscribe, set } = writable(getInitialTheme());
  
  return {
    subscribe,
    set: (value) => {
      // Validate the theme
      if (!Object.values(THEMES).includes(value)) {
        value = THEMES.LIGHT;
      }
      
      // Apply the theme to the document
      if (typeof document !== 'undefined') {
        if (value === THEMES.DARK || 
            (value === THEMES.SYSTEM && 
             window.matchMedia && 
             window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
      
      // Save to localStorage
      try {
        localStorage.setItem('nodus-theme', value);
      } catch (e) {
        console.warn('Failed to save theme to localStorage', e);
      }
      
      // Save to database
      db.storeSettings({ theme: value }).catch(e => {
        console.warn('Failed to save theme to database', e);
      });
      
      // Update the store
      set(value);
    },
    
    // Toggle between light and dark (not system)
    toggle: () => {
      subscribe(currentTheme => {
        const newTheme = currentTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
        theme.set(newTheme);
      })();
    },
    
    // Constants
    THEMES
  };
}

export const theme = createThemeStore();