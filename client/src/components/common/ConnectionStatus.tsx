import React, { useCallback, useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, WifiOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getRelayStatus } from '../../lib/ndk';
import { useToast } from '@/hooks/use-toast';

export function ConnectionStatus() {
  const [status, setStatus] = useState<'online' | 'limited' | 'offline'>('offline');
  const [relayCount, setRelayCount] = useState(0);
  const [connectedCount, setConnectedCount] = useState(0);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const [isChecking, setIsChecking] = useState(false);
  const { toast } = useToast();

  const checkConnections = useCallback(async () => {
    setIsChecking(true);
    try {
      const relays = await getRelayStatus();
      setRelayCount(relays.length);
      const connected = relays.filter(r => r.connected);
      setConnectedCount(connected.length);
      
      if (connected.length === 0) {
        setStatus('offline');
      } else if (connected.length < relays.length) {
        setStatus('limited');
      } else {
        setStatus('online');
      }
      
      setLastChecked(new Date());
    } catch (error) {
      console.error('Error checking relay status:', error);
      setStatus('offline');
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Initial check
  useEffect(() => {
    checkConnections();
    
    // Periodically check connections
    const interval = setInterval(() => {
      checkConnections();
    }, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [checkConnections]);
  
  // Show deployment notice for Replit environment
  const isReplitEnvironment = window.location.hostname.includes('.replit.app') || 
                           window.location.hostname.includes('.repl.co');

  const getStatusColor = () => {
    switch (status) {
      case 'online': return 'text-green-500';
      case 'limited': return 'text-amber-500';
      case 'offline': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };
  
  const getStatusText = () => {
    switch (status) {
      case 'online': return 'Connected';
      case 'limited': return 'Limited';
      case 'offline': return 'Offline';
      default: return 'Unknown';
    }
  };
  
  const handleManualCheck = () => {
    toast({
      title: 'Checking connections',
      description: 'Connecting to Nostr relays...',
    });
    checkConnections();
  };

  return (
    <div className="mb-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {status === 'offline' ? (
            <WifiOff className="h-4 w-4 text-red-500" />
          ) : (
            <div className={`h-3 w-3 rounded-full ${getStatusColor()} mr-1`} />
          )}
          <span className="text-sm">
            {getStatusText()} ({connectedCount}/{relayCount} relays)
          </span>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 w-7 p-0" 
                onClick={handleManualCheck}
                disabled={isChecking}
              >
                <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
                <span className="sr-only">Refresh</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Check connection status</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      {isReplitEnvironment && status === 'offline' && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-sm font-medium ml-2">WebSocket Connection Limitation</AlertTitle>
          <AlertDescription className="text-xs ml-2">
            Replit environment may block outbound WebSocket connections. 
            For full functionality, deploy to production or run locally.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}