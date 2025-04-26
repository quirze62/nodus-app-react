import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getRelayStatus, connectNDK, getNDK } from '@/lib/ndk';

interface RelayStatus {
  url: string;
  connected: boolean;
}

export const ConnectionStatus: React.FC = () => {
  const [relayStatuses, setRelayStatuses] = useState<RelayStatus[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  const fetchStatus = async () => {
    try {
      const statuses = await getRelayStatus();
      setRelayStatuses(statuses);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch relay status:', err);
    }
  };
  
  useEffect(() => {
    // Fetch status immediately and then every 15 seconds
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    
    return () => clearInterval(interval);
  }, []);
  
  const handleReconnect = async () => {
    setIsConnecting(true);
    
    try {
      const ndk = await getNDK();
      await connectNDK(ndk, 3, 5000);
      
      // Refresh status after connection attempt
      await fetchStatus();
    } catch (err) {
      console.error('Error reconnecting to relays:', err);
    } finally {
      setIsConnecting(false);
    }
  };
  
  const connectedCount = relayStatuses.filter(s => s.connected).length;
  const totalCount = relayStatuses.length;
  const anyConnected = connectedCount > 0;
  
  // Format time to display minutes since last update
  const timeSinceUpdate = Math.floor((new Date().getTime() - lastUpdated.getTime()) / 1000);
  const timeDisplay = timeSinceUpdate < 60 
    ? `${timeSinceUpdate}s ago` 
    : `${Math.floor(timeSinceUpdate / 60)}m ago`;
  
  return (
    <div className="flex items-center space-x-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center cursor-help">
              {anyConnected ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              <span className="ml-1 text-xs">
                {connectedCount}/{totalCount}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent className="w-64 p-3" align="end">
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-medium">
                <span>Nostr Relay Status</span>
                <span className="text-xs text-gray-500">Updated {timeDisplay}</span>
              </div>
              
              <div className="space-y-1 text-xs max-h-48 overflow-y-auto">
                {relayStatuses.map((relay) => (
                  <div key={relay.url} className="flex items-center justify-between">
                    <span className="truncate max-w-[180px]">{relay.url}</span>
                    <span className={relay.connected ? 'text-green-500' : 'text-red-500'}>
                      {relay.connected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                ))}
              </div>
              
              <Button 
                size="sm"
                variant="outline"
                className="w-full text-xs"
                disabled={isConnecting}
                onClick={handleReconnect}
              >
                {isConnecting ? 'Connecting...' : 'Reconnect to Relays'}
              </Button>
              
              <div className="text-xs flex items-start">
                <Info className="h-3 w-3 mt-0.5 mr-1" />
                <span className="text-gray-500">
                  {anyConnected 
                    ? 'Your app is connected to the Nostr network.' 
                    : 'Not connected to any Nostr relays. Some features may be unavailable.'}
                </span>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default ConnectionStatus;