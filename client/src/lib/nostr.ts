// Simple Nostr implementation based on NIP standards
import { generateSecretKey, getPublicKey, nip19, nip04 } from 'nostr-tools';

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface NostrProfile {
  name?: string;
  about?: string;
  picture?: string;
  nip05?: string;
}

export interface NostrUser {
  publicKey: string;
  privateKey?: string;
  npub: string;
  nsec?: string;
  profile?: NostrProfile;
}

// Event kinds as defined in NIPs
export const EventKind = {
  SET_METADATA: 0, // NIP-01
  TEXT_NOTE: 1, // NIP-01
  RECOMMEND_SERVER: 2, // NIP-01
  CONTACTS: 3, // NIP-02
  ENCRYPTED_DIRECT_MESSAGE: 4, // NIP-04
  DELETE: 5, // NIP-09
  REPOST: 6, // NIP-18
  REACTION: 7, // NIP-25
  BADGE_AWARD: 8, // NIP-58
};

// Generate a new key pair
export function generateKeyPair(): NostrUser {
  const privateKey = generateSecretKey();
  const publicKey = getPublicKey(privateKey);
  
  const npub = nip19.npubEncode(publicKey);
  const nsec = nip19.nsecEncode(privateKey);
  
  return {
    publicKey: publicKey.toString(),
    privateKey: Buffer.from(privateKey).toString('hex'),
    npub,
    nsec,
  };
}

// Import an existing key
export function importKeyFromNsec(nsec: string): NostrUser | null {
  try {
    const { type, data } = nip19.decode(nsec);
    if (type !== 'nsec') return null;
    
    const privateKey = data;
    const publicKey = getPublicKey(privateKey);
    const npub = nip19.npubEncode(publicKey);
    
    return {
      publicKey: publicKey.toString(),
      privateKey: Buffer.from(privateKey).toString('hex'),
      npub,
      nsec,
    };
  } catch (error) {
    console.error('Error importing key:', error);
    return null;
  }
}

// NIP-04: Encrypted direct messages
export async function encryptMessage(
  sender: { privateKey: string },
  recipientPubkey: string,
  content: string
): Promise<string> {
  try {
    const encryptedContent = await nip04.encrypt(
      sender.privateKey,
      recipientPubkey,
      content
    );
    return encryptedContent;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt message');
  }
}

export async function decryptMessage(
  recipient: { privateKey: string },
  senderPubkey: string,
  encryptedContent: string
): Promise<string> {
  try {
    const decryptedContent = await nip04.decrypt(
      recipient.privateKey,
      senderPubkey,
      encryptedContent
    );
    return decryptedContent;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt message');
  }
}

// Simplified event creation
export function createEventId(event: Omit<NostrEvent, 'id' | 'sig'>): string {
  // In a real implementation, this would create a proper NIP-01 event ID
  // For now, returning a mock event ID
  return `mock-event-${Math.random().toString(36).substring(2, 15)}`;
}

// Simplified signing (in a real app, this would use the proper NIP-01 signing)
export function signEvent(event: NostrEvent, privateKey: string): string {
  // In a real implementation, this would sign the event according to NIP-01
  // For now, returning a mock signature
  return `mock-signature-${Math.random().toString(36).substring(2, 15)}`;
}
