import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Wifi, WifiOff, AlertTriangle, RefreshCw, Badge as BadgeIcon } from "lucide-react";
import { useNdk } from '@/contexts/NdkContext';
import { useToast } from "@/hooks/use-toast";
import { ConnectionStatus } from '../common/ConnectionStatus';
import NDK, { NDKRelay, NDKRelayStatus } from '@nostr-dev-kit/ndk';

// Default Nostr relays
const DEFAULT_RELAYS = [
  'wss://relay.mynodus.com',
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://nostr.wine'
];

// Relay interface for the UI
interface RelayInfo {
  url: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  read: boolean;
  write: boolean;
  latency?: number;
  relay: NDKRelay;
}

export default function RelaySettings() {
  const [relays, setRelays] = useState<RelayInfo[]>([]);
  const [newRelayUrl, setNewRelayUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { ndk } = useNdk();

  // Load relays on mount
  useEffect(() => {
    if (!ndk || !ndk.pool) return;
    
    const loadRelays = () => {
      setIsLoading(true);
      
      const relayInfos: RelayInfo[] = [];
      
      // Get relays from NDK
      if (ndk.pool.relays) {
        // The relays property is of type Map<string, NDKRelay>
        ndk.pool.relays.forEach((relay, url) => {
          let status: 'connected' | 'connecting' | 'disconnected' | 'error' = 'disconnected';
          
          // Map NDK status to our UI status
          if (relay.status === NDKRelayStatus.CONNECTED) {
            status = 'connected';
          } else if (relay.status === NDKRelayStatus.CONNECTING) {
            status = 'connecting';
          } else if (relay.status === NDKRelayStatus.DISCONNECTED) {
            status = 'disconnected';
          } else {
            // Fallback for any other status including errors
            status = 'error';
          }
          
          // According to the NDK docs, relays have read/write properties
          const isReadable = relay.settings?.read !== false;
          const isWritable = relay.settings?.write !== false;
          
          relayInfos.push({
            url,
            status,
            read: isReadable,
            write: isWritable,
            latency: typeof relay.latency === 'number' ? relay.latency : undefined,
            relay
          });
        });
      }
      
      setRelays(relayInfos);
      setIsLoading(false);
    };

    // Load initial relays
    loadRelays();

    // Set up an interval to refresh relay statuses
    const intervalId = setInterval(loadRelays, 5000);

    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, [ndk]);

  // Handle adding a new relay
  const handleAddRelay = async () => {
    if (!ndk) {
      toast({
        title: "Error",
        description: "NDK not initialized",
        variant: "destructive"
      });
      return;
    }
    
    if (!newRelayUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid relay URL",
        variant: "destructive"
      });
      return;
    }

    setIsAdding(true);

    try {
      // Create a new relay object with the URL
      const relay = new NDKRelay(newRelayUrl);
      
      // Add the relay to NDK
      await ndk.pool?.addRelay(relay);
      
      toast({
        title: "Success",
        description: `Added relay ${newRelayUrl}`,
      });
      setNewRelayUrl('');
      
    } catch (error) {
      console.error("Error adding relay:", error);
      toast({
        title: "Error",
        description: "Failed to add relay",
        variant: "destructive"
      });
    } finally {
      setIsAdding(false);
    }
  };

  // Handle removing a relay
  const handleRemoveRelay = async (url: string) => {
    if (!ndk || !ndk.pool?.relays) {
      toast({
        title: "Error",
        description: "NDK not initialized",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Get the relay instance from the map
      const relay = ndk.pool.relays.get(url);
      
      if (relay) {
        // Remove the relay from NDK
        await ndk.pool.removeRelay(relay);
        
        toast({
          title: "Success",
          description: `Removed relay ${url}`,
        });
      } else {
        toast({
          title: "Error", 
          description: `Relay ${url} not found`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error removing relay:", error);
      toast({
        title: "Error",
        description: "Failed to remove relay",
        variant: "destructive"
      });
    }
  };

  // Handle updating relay read/write settings
  const handleUpdateRelay = async (url: string, read: boolean, write: boolean) => {
    if (!ndk || !ndk.pool?.relays) {
      toast({
        title: "Error",
        description: "NDK not initialized",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const relay = ndk.pool.relays.get(url);
      if (relay) {
        // Update relay settings
        if (!relay.settings) {
          relay.settings = {};
        }
        
        relay.settings.read = read;
        relay.settings.write = write;
        
        toast({
          title: "Success",
          description: `Updated relay ${url}`,
        });
      } else {
        toast({
          title: "Error",
          description: `Relay ${url} not found`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error updating relay:", error);
      toast({
        title: "Error",
        description: "Failed to update relay",
        variant: "destructive"
      });
    }
  };

  // Handle restoring default relays
  const handleRestoreDefaults = async () => {
    if (!ndk || !ndk.pool) {
      toast({
        title: "Error",
        description: "NDK not initialized",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Clear existing relays
      if (ndk.pool.relays) {
        // Get all current relays 
        const currentRelays: NDKRelay[] = [];
        ndk.pool.relays.forEach(relay => currentRelays.push(relay));
        
        // Remove each relay
        for (const relay of currentRelays) {
          await ndk.pool.removeRelay(relay);
        }
      }
      
      // Add default relays
      for (const url of DEFAULT_RELAYS) {
        const relay = new NDKRelay(url);
        await ndk.pool.addRelay(relay);
      }
      
      toast({
        title: "Success",
        description: "Restored default relays",
      });
    } catch (error) {
      console.error("Error restoring default relays:", error);
      toast({
        title: "Error",
        description: "Failed to restore default relays",
        variant: "destructive"
      });
    }
  };

  // Manually refresh relay connections
  const handleRefreshConnections = () => {
    if (!ndk || !ndk.pool) {
      toast({
        title: "Error",
        description: "NDK not initialized",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Connect to all relays
      ndk.pool.relays?.forEach(relay => {
        if (relay.status !== NDKRelayStatus.CONNECTED) {
          relay.connect();
        }
      });
      
      toast({
        title: "Refreshing Connections",
        description: "Attempting to reconnect to all relays",
      });
    } catch (error) {
      console.error("Error refreshing connections:", error);
    }
  };

  // Get status badge for relay
  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'connected':
        return <Badge className="bg-green-500"><Wifi className="h-3 w-3 mr-1" /> Connected</Badge>;
      case 'connecting':
        return <Badge className="bg-yellow-500"><Wifi className="h-3 w-3 mr-1" /> Connecting</Badge>;
      case 'disconnected':
        return <Badge className="bg-gray-500"><WifiOff className="h-3 w-3 mr-1" /> Disconnected</Badge>;
      case 'error':
        return <Badge className="bg-red-500"><AlertTriangle className="h-3 w-3 mr-1" /> Error</Badge>;
      default:
        return <Badge className="bg-gray-500">{status}</Badge>;
    }
  };

  // Format latency display
  const formatLatency = (latency?: number) => {
    if (latency === undefined) return '—';
    if (latency < 0) return 'Timeout';
    return `${latency}ms`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Nostr Relay Settings</CardTitle>
        <CardDescription>
          Manage your Nostr relays. Add, remove, or configure which relays to connect to.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall connection status */}
        <ConnectionStatus />
        
        {/* NDK Information */}
        <div className="border border-blue-300 rounded-md p-4 bg-blue-50 dark:bg-blue-900/20 mb-4">
          <div className="flex items-center mb-2">
            <BadgeIcon className="h-4 w-4 mr-2 text-blue-600" />
            <h3 className="text-sm font-medium text-blue-600">Connection Information</h3>
          </div>
          <p className="text-xs text-blue-600 mb-2">
            Using NDK (Nostr Development Kit) for relay connections. NDK provides a robust and standard way to connect to the Nostr network.
          </p>
          <div className="mt-2 p-2 bg-blue-100 dark:bg-blue-900/20 rounded text-xs text-blue-700 dark:text-blue-300">
            <span>NDK Status: {ndk ? "Initialized" : "Not initialized"}</span>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <Button 
            variant="outline" 
            onClick={handleRefreshConnections}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Connections
          </Button>
          <Button variant="outline" onClick={handleRestoreDefaults}>
            Restore defaults
          </Button>
        </div>

        <div className="flex space-x-2">
          <Input
            placeholder="wss://relay.example.com"
            value={newRelayUrl}
            onChange={(e) => setNewRelayUrl(e.target.value)}
            disabled={isAdding}
          />
          <Button onClick={handleAddRelay} disabled={isAdding}>
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Relay URL</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Latency</TableHead>
              <TableHead>Read</TableHead>
              <TableHead>Write</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {relays.map((relay) => (
              <TableRow key={relay.url}>
                <TableCell className="font-mono text-sm">{relay.url}</TableCell>
                <TableCell>{getStatusBadge(relay.status)}</TableCell>
                <TableCell>{formatLatency(relay.latency)}</TableCell>
                <TableCell>
                  <Switch 
                    checked={relay.read}
                    onCheckedChange={(checked) => handleUpdateRelay(relay.url, checked, relay.write)}
                  />
                </TableCell>
                <TableCell>
                  <Switch 
                    checked={relay.write}
                    onCheckedChange={(checked) => handleUpdateRelay(relay.url, relay.read, checked)}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveRelay(relay.url)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            
            {relays.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                  No relays configured. Add a relay or restore defaults.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        <p>
          Relays are servers that store and transmit Nostr events. You can connect to multiple relays to increase your reach in the Nostr network.
        </p>
      </CardFooter>
    </Card>
  );
}