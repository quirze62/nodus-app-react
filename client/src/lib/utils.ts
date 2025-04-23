import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { EventKind } from "./nostr";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format a date for display
export function formatDate(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date * 1000) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  
  // Convert diff to seconds
  const seconds = Math.floor(diff / 1000);
  
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  
  // Convert to minutes
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  
  // Convert to hours
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  
  // Convert to days
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  
  // If it's more than a week, show the date
  return d.toLocaleDateString();
}

// Format a pubkey for display
export function formatPubkey(pubkey: string, length = 8): string {
  if (!pubkey) return '';
  if (pubkey.startsWith('npub')) {
    return `${pubkey.substring(0, 4)}...${pubkey.substring(pubkey.length - length)}`;
  }
  return `${pubkey.substring(0, 4)}...${pubkey.substring(pubkey.length - length)}`;
}

// Extract hashtags from text
export function extractHashtags(text: string): string[] {
  const hashtagRegex = /#(\w+)/g;
  const matches = text.match(hashtagRegex);
  if (!matches) return [];
  return matches.map(tag => tag.substring(1));
}

// Extract mentions from text
export function extractMentions(text: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const matches = text.match(mentionRegex);
  if (!matches) return [];
  return matches.map(mention => mention.substring(1));
}

// Get appropriate icon for event kind - returning string to avoid JSX in utils
export function getEventIcon(kind: number): string {
  switch (kind) {
    case EventKind.TEXT_NOTE:
      return "text-note";
    case EventKind.ENCRYPTED_DIRECT_MESSAGE:
      return "encrypted-message";
    case EventKind.REPOST:
      return "repost";
    case EventKind.REACTION:
      return "reaction";
    default:
      return "unknown";
  }
}

// Check if device is online
export function isOnline(): boolean {
  return navigator.onLine;
}

// Safe JSON parse
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    return fallback;
  }
}
