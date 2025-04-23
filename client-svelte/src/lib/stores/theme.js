import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
};

function createThemeStore() {
  // Get saved theme from localStorage or use system default
  const getInitialTheme = () => {
    if (browser) {
      const saved = localStorage.getItem('nodus-theme');
      if (saved && (saved === THEMES.LIGHT || saved === THEMES.DARK || saved === THEMES.SYSTEM)) {
        return saved;
      }
    }
    return THEMES.SYSTEM;
  };

  const { subscribe, set, update } = writable(getInitialTheme());

  // Apply theme to the document
  const applyTheme = (theme) => {
    if (!browser) return;

    // For system theme, check user's preference
    if (theme === THEMES.SYSTEM) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.body.classList.toggle('dark', prefersDark);
    } else {
      document.body.classList.toggle('dark', theme === THEMES.DARK);
    }
  };

  if (browser) {
    // Apply the current theme initially
    applyTheme(getInitialTheme());

    // Set up listener for system preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      const currentTheme = localStorage.getItem('nodus-theme');
      if (currentTheme === THEMES.SYSTEM) {
        document.body.classList.toggle('dark', e.matches);
      }
    });
  }

  // Change the theme
  const setTheme = (newTheme) => {
    if (browser) {
      localStorage.setItem('nodus-theme', newTheme);
      applyTheme(newTheme);
    }
    set(newTheme);
  };

  return {
    subscribe,
    setTheme,
    reset: () => setTheme(THEMES.SYSTEM)
  };
}

export const theme = createThemeStore();
export { setTheme } from './theme';