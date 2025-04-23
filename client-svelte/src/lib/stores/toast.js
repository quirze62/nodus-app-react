import { writable } from 'svelte/store';

// Types of toast messages
const TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
  WARNING: 'warning'
};

// Default duration for toast messages
const DEFAULT_DURATION = 5000; // 5 seconds

// Create toast store
function createToastStore() {
  const { subscribe, update } = writable([]);
  
  // Generate unique ID for toasts
  const generateId = () => `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  return {
    subscribe,
    
    // Add a new toast message
    add: (message, options = {}) => {
      const id = generateId();
      const type = options.type || TYPES.INFO;
      const duration = options.duration || DEFAULT_DURATION;
      
      // Create the toast item
      const toast = {
        id,
        message,
        type,
        duration,
        timestamp: Date.now()
      };
      
      // Add to store
      update(toasts => [...toasts, toast]);
      
      // Set up auto-removal
      if (duration > 0) {
        setTimeout(() => {
          update(toasts => toasts.filter(t => t.id !== id));
        }, duration);
      }
      
      return id;
    },
    
    // Remove a toast by ID
    remove: (id) => {
      update(toasts => toasts.filter(toast => toast.id !== id));
    },
    
    // Clear all toasts
    clear: () => {
      update(() => []);
    },
    
    // Shorthand methods for different toast types
    success: (message, options = {}) => {
      return toast.add(message, { ...options, type: TYPES.SUCCESS });
    },
    
    error: (message, options = {}) => {
      return toast.add(message, { ...options, type: TYPES.ERROR });
    },
    
    info: (message, options = {}) => {
      return toast.add(message, { ...options, type: TYPES.INFO });
    },
    
    warning: (message, options = {}) => {
      return toast.add(message, { ...options, type: TYPES.WARNING });
    },
    
    // Constants
    TYPES
  };
}

export const toast = createToastStore();