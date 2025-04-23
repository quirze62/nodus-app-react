import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// Import Svelte app
import './main.js';

// This is a React component that does nothing, just to satisfy TypeScript
const App: React.FC = () => {
  return <div id="app"></div>;
};

// We don't actually use this React render, but it satisfies the TypeScript compiler
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);