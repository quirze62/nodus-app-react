import { writable } from 'svelte/store';

// Function to generate a unique ID
const generateId = () => `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Create a writable store with an empty array
const createToastStore = () => {
  // Initialize with empty array
  const { subscribe, update } = writable([]);
  
  // Function to add a toast
  const add = (text, type = 'info', duration = 5000) => {
    const id = generateId();
    
    // Add toast to the store
    update(toasts => [...toasts, { id, text, type }]);
    
    // Set a timeout to remove the toast
    if (duration) {
      setTimeout(() => {
        remove(id);
      }, duration);
    }
    
    return id;
  };
  
  // Function to remove a toast by ID
  const remove = (id) => {
    update(toasts => toasts.filter(toast => toast.id !== id));
  };
  
  // Convenience functions for different toast types
  const success = (text, duration) => add(text, 'success', duration);
  const error = (text, duration) => add(text, 'error', duration);
  const warning = (text, duration) => add(text, 'warning', duration);
  const info = (text, duration) => add(text, 'info', duration);
  
  // Clear all toasts
  const clear = () => {
    update(() => []);
  };
  
  return {
    subscribe,
    add,
    remove,
    success,
    error,
    warning,
    info,
    clear
  };
};

// Create and export the store
export const toast = createToastStore();