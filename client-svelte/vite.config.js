import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Base path for assets
  base: '/',
  
  // Plugins
  plugins: [
    // Svelte plugin
    svelte(),
    
    // Tailwind CSS plugin
    tailwindcss()
  ],
  
  // Resolve aliases
  resolve: {
    alias: {
      '@assets': resolve('./src/assets'),
      '@components': resolve('./src/lib/components'),
      '@lib': resolve('./src/lib'),
      '@routes': resolve('./src/routes'),
      '@styles': resolve('./src/styles')
    }
  },
  
  // Server options
  server: {
    port: 3000,
    host: '0.0.0.0',
    
    // Proxy API requests to backend server
    proxy: {
      '/api': 'http://localhost:5000'
    }
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: [
      '@nostr-dev-kit/ndk',
      '@nostr-dev-kit/ndk-svelte',
      'date-fns',
      'dexie'
    ]
  },
  
  // Build options
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'terser',
    sourcemap: true,
    emptyOutDir: true
  }
});