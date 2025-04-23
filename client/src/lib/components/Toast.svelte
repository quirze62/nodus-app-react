<script>
  import { toast } from '../stores/toast';
  import { fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  
  // Icon mapping
  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️'
  };
</script>

<div class="toast-container">
  {#each $toast as item (item.id)}
    <div 
      class="toast toast-{item.type}" 
      animate:flip={{duration: 300}}
      transition:fly={{y: 20, duration: 300}}
    >
      <div class="toast-icon">{icons[item.type]}</div>
      <div class="toast-content">{item.message}</div>
      <button class="toast-close" on:click={() => toast.remove(item.id)}>✕</button>
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    z-index: 1000;
    max-width: 350px;
  }
  
  .toast {
    display: flex;
    align-items: center;
    padding: 1rem;
    border-radius: 0.5rem;
    color: white;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    animation: slide-in 0.3s ease-out;
  }
  
  .toast-success {
    background-color: #4CAF50;
  }
  
  .toast-error {
    background-color: #F44336;
  }
  
  .toast-info {
    background-color: #2196F3;
  }
  
  .toast-warning {
    background-color: #FF9800;
  }
  
  .toast-icon {
    margin-right: 0.5rem;
    font-size: 1.25rem;
  }
  
  .toast-content {
    flex: 1;
    font-size: 0.9rem;
  }
  
  .toast-close {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    font-size: 1rem;
    opacity: 0.7;
    margin-left: 0.5rem;
    transition: opacity 0.2s;
  }
  
  .toast-close:hover {
    opacity: 1;
  }
  
  @keyframes slide-in {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
</style>