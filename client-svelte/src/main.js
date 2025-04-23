import './styles.css';
import App from './App.svelte';
import { NDKSvelteSigil } from '@nostr-dev-kit/ndk-svelte';
import { NDKProvider } from './lib/services/ndk-config';

// Inject global CSS
const style = document.createElement('style');
style.textContent = `
  :root {
    --nodus-blue: #145ce8;
  }
  
  body {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    background-color: #f9f9f9;
    color: #333;
  }
  
  body.dark {
    background-color: #121212;
    color: #eee;
  }
`;
document.head.appendChild(style);

// Create app instance
const app = new App({
  target: document.getElementById('app'),
})

export default app;