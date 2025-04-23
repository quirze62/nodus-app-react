import { writable } from 'svelte/store';
import { db } from '../db/db';

// Get the initial theme from localStorage or default to 'system'
const getInitialTheme = () => {
  // Check if we have a theme in LocalStorage
  const storedTheme = typeof localStorage !== 'undefined' ? localStorage.getItem('theme') : null;
  
  // Return the stored theme or default to 'system'
  return storedTheme || 'system';
};

// Create a writable store with the initial theme
const theme = writable(getInitialTheme());

// Subscribe to theme changes and update localStorage
if (typeof localStorage !== 'undefined') {
  theme.subscribe(value => {
    localStorage.setItem('theme', value);
    
    // Also store in IndexedDB for persistence across sessions
    db.setTheme(value).catch(err => console.error('Error storing theme:', err));
  });
}

// Export the store
export { theme };