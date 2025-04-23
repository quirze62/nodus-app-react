import { writable } from 'svelte/store';

// Theme options
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
};

// Function to get user's system theme preference
const getSystemTheme = () => {
  if (typeof window === 'undefined') return THEMES.LIGHT;
  return window.matchMedia('(prefers-color-scheme: dark)').matches 
    ? THEMES.DARK 
    : THEMES.LIGHT;
};

// Function to get initial theme
const getInitialTheme = () => {
  if (typeof window === 'undefined') return THEMES.LIGHT;
  
  const storedTheme = localStorage.getItem('nodus_theme');
  if (storedTheme && Object.values(THEMES).includes(storedTheme)) {
    return storedTheme;
  }
  
  return THEMES.SYSTEM;
};

// Create theme store
export const theme = writable(getInitialTheme());

// Function to apply theme to document
const applyTheme = (newTheme) => {
  if (typeof window === 'undefined') return;
  
  const effectiveTheme = newTheme === THEMES.SYSTEM 
    ? getSystemTheme() 
    : newTheme;
  
  if (effectiveTheme === THEMES.DARK) {
    document.body.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
  }
};

// Watch for theme changes and apply them
theme.subscribe(newTheme => {
  applyTheme(newTheme);
  
  if (typeof window !== 'undefined') {
    localStorage.setItem('nodus_theme', newTheme);
  }
});

// Watch for system theme changes if using system theme
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      const currentTheme = localStorage.getItem('nodus_theme');
      if (currentTheme === THEMES.SYSTEM) {
        applyTheme(THEMES.SYSTEM);
      }
    });
}

/**
 * Set the theme
 * @param {string} newTheme - Theme to set (light, dark, or system)
 */
export const setTheme = (newTheme) => {
  if (Object.values(THEMES).includes(newTheme)) {
    theme.set(newTheme);
  } else {
    console.error(`Invalid theme: ${newTheme}. Use one of: ${Object.values(THEMES).join(', ')}`);
  }
};