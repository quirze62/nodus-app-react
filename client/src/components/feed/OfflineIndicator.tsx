import React, { useEffect, useState } from 'react';
import { AlertCircle, WifiOff, Wifi, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getRelayStatus, connectNDK, getNDK } from '@/lib/ndk';
import logger from '@/lib/logger';

const OfflineIndicator: React.FC = () => {
  const [isOffline, setIsOffline] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [reconnecting, setReconnecting] = useState(false);
  const [showIndicator, setShowIndicator] = useState(false);
  
  // Check offline status on mount and periodically
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const status = await getRelayStatus();
        const hasConnectedRelays = status.some(relay => relay.connected);
        
        // Only show indicator if we're actually offline
        if (!hasConnectedRelays && !isOffline) {
          setIsOffline(true);
          setShowIndicator(true);
        } else if (hasConnectedRelays && isOffline) {
          setIsOffline(false);
          // Keep showing for a moment so user can see we're back online
          setTimeout(() => {
            setShowIndicator(false);
          }, 3000);
        }
      } catch (err) {
        logger.error("Failed to check relay status:", err);
        setIsOffline(true);
        setShowIndicator(true);
      }
    };
    
    // Check immediately and then every 10 seconds
    checkConnection();
    const interval = setInterval(checkConnection, 10000);
    
    // Also listen for online/offline events from the browser
    const handleOnline = () => {
      logger.info("Browser reports online status");
      checkConnection();
    };
    
    const handleOffline = () => {
      logger.info("Browser reports offline status");
      setIsOffline(true);
      setShowIndicator(true);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOffline]);
  
  const handleReconnect = async () => {
    setReconnecting(true);
    setConnectionAttempts(prev => prev + 1);
    
    try {
      // Get the NDK instance and manually try to reconnect
      const ndk = await getNDK();
      const success = await connectNDK(ndk, 3, 5000);
      
      if (success) {
        setIsOffline(false);
        // Keep showing for a moment so user can see we're back online
        setTimeout(() => {
          setShowIndicator(false);
        }, 3000);
      } else {
        // Still offline, update UI accordingly
        setIsOffline(true);
      }
    } catch (err) {
      logger.error("Failed to reconnect:", err);
    } finally {
      setReconnecting(false);
    }
  };

  if (!showIndicator) return null;
  
  return (
    <Alert 
      variant={isOffline ? "destructive" : "default"} 
      className="fixed bottom-4 right-4 w-72 z-50 shadow-lg"
    >
      <div className="flex items-center">
        {isOffline ? 
          <WifiOff className="h-5 w-5 mr-2" /> : 
          <Wifi className="h-5 w-5 mr-2 text-green-500" />
        }
        <AlertTitle>
          {isOffline ? "Offline Mode" : "Connected"} 
        </AlertTitle>
      </div>
      
      <AlertDescription className="mt-2">
        {isOffline ? (
          <>
            <p className="text-sm mb-2">
              No connection to Nostr relays. 
              {connectionAttempts > 0 && " Multiple reconnection attempts failed."}
            </p>
            <div className="flex justify-end">
              <Button 
                size="sm" 
                variant="outline"
                disabled={reconnecting}
                onClick={handleReconnect}
                className="flex items-center"
              >
                {reconnecting ? 
                  "Connecting..." : 
                  <>Reconnect <AlertCircle className="ml-1 h-4 w-4" /></>
                }
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center">
            <Check className="h-4 w-4 mr-1 text-green-500" />
            <span>Successfully connected to Nostr relays!</span>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
};

export default OfflineIndicator;