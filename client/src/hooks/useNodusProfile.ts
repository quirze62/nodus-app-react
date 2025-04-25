import { useState, useEffect } from 'react';
import { useNDK } from '@nostr-dev-kit/ndk-hooks';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import logger from '../lib/logger';
import { NostrProfile } from '../lib/nostr';
import { db } from '../lib/db';

// Profile data is stored in kind 0 events
const METADATA_KIND = 0;

export function useNodusProfile(pubkey: string | undefined) {
  const { ndk } = useNDK();
  const [profile, setProfile] = useState<NostrProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch profile whenever pubkey or ndk changes
  useEffect(() => {
    if (!ndk || !pubkey) {
      setIsLoading(false);
      return;
    }
    
    const fetchProfile = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Try to get from local database first
        const cachedProfile = await db.getProfile(pubkey);
        
        if (cachedProfile) {
          logger.info(`Using cached profile for ${pubkey}`);
          setProfile(cachedProfile);
          setIsLoading(false);
          return;
        }
        
        // Get from network
        logger.info(`Fetching profile for ${pubkey}`);
        const ndkUser = ndk.getUser({ pubkey });
        await ndkUser.fetchProfile();
        
        if (!ndkUser.profile) {
          logger.info(`No profile found for ${pubkey}`);
          setIsLoading(false);
          return;
        }
        
        // Convert to our format
        const profile: NostrProfile = {
          name: ndkUser.profile.name,
          about: ndkUser.profile.about,
          picture: ndkUser.profile.image,
          nip05: ndkUser.profile.nip05
        };
        
        // Cache in database
        await db.storeProfile(pubkey, profile);
        
        setProfile(profile);
      } catch (err) {
        logger.error(`Error fetching profile for ${pubkey}`, err);
        setError('Failed to fetch profile');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProfile();
  }, [ndk, pubkey]);
  
  // Update profile
  const updateProfile = async (updatedProfile: NostrProfile): Promise<boolean> => {
    if (!ndk || !ndk.signer) {
      setError('Not signed in');
      return false;
    }
    
    try {
      // First get the current user's pubkey
      const user = await ndk.signer.user();
      
      // Create profile content
      const profileContent = {
        name: updatedProfile.name,
        about: updatedProfile.about,
        picture: updatedProfile.picture,
        nip05: updatedProfile.nip05
      };
      
      // Create event
      const event = new NDKEvent(ndk);
      event.kind = METADATA_KIND;
      event.content = JSON.stringify(profileContent);
      
      // Publish
      await event.publish();
      
      // Update in database
      await db.storeProfile(user.pubkey, updatedProfile);
      
      // Update state
      setProfile(updatedProfile);
      
      return true;
    } catch (err) {
      logger.error('Error updating profile', err);
      setError('Failed to update profile');
      return false;
    }
  };
  
  return {
    profile,
    isLoading,
    error,
    updateProfile
  };
}