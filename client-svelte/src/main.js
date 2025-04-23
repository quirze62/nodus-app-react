import './styles.css';
import App from './App.svelte';
import { Router } from 'svelte-routing';

// Create app instance
const app = new App({
  target: document.getElementById('app'),
  props: {
    url: window.location.pathname
  }
})

export default app;