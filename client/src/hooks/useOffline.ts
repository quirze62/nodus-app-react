import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';

interface UseOfflineReturn {
  isOffline: boolean;
  lastSynced: Date | null;
  syncWhenOnline: () => Promise<boolean>;
}

export function useOffline(): UseOfflineReturn {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const { toast } = useToast();

  // Update offline status when network status changes
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast({
        title: 'You are online',
        description: 'Your data will now sync to the network',
      });
    };

    const handleOffline = () => {
      setIsOffline(true);
      toast({
        title: 'You are offline',
        description: 'Content will be available from local cache',
        variant: 'destructive',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load last sync time from DB
    db.getLastSync().then(lastSync => {
      setLastSynced(lastSync);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

  // Function to sync data when back online
  const syncWhenOnline = useCallback(async (): Promise<boolean> => {
    if (isOffline) {
      toast({
        title: 'Still offline',
        description: 'Cannot sync while offline',
        variant: 'destructive',
      });
      return false;
    }

    try {
      // In a real app, we would push cached events to the network here
      // For now, just simulate a sync
      toast({
        title: 'Syncing...',
        description: 'Synchronizing data with the network',
      });

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Update last sync time
      const now = new Date();
      await db.updateLastSync();
      setLastSynced(now);

      toast({
        title: 'Sync complete',
        description: 'Your data has been synchronized',
      });

      return true;
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: 'Sync failed',
        description: 'Failed to synchronize data',
        variant: 'destructive',
      });
      return false;
    }
  }, [isOffline, toast]);

  return {
    isOffline,
    lastSynced,
    syncWhenOnline,
  };
}
