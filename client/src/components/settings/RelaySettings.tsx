import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Wifi, WifiOff, AlertTriangle, Bug } from "lucide-react";
import { DEFAULT_RELAYS, getRelayManager, ManagedRelay } from '@/lib/relayManager';
import { useToast } from "@/hooks/use-toast";
import { ConnectionStatus } from '../common/ConnectionStatus';
import { WebSocketTester } from '../common/WebSocketTester';
import { DirectNostrRelayTest } from '../common/DirectNostrRelayTest';

export default function RelaySettings() {
  const [relays, setRelays] = useState<ManagedRelay[]>([]);
  const [newRelayUrl, setNewRelayUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [autoReconnect, setAutoReconnect] = useState(true);
  const { toast } = useToast();
  const relayManager = getRelayManager();

  // Load relays on mount
  useEffect(() => {
    const loadRelays = () => {
      const loadedRelays = relayManager.getAllRelays();
      setRelays(loadedRelays);
    };

    // Load initial relays
    loadRelays();

    // Set up an interval to refresh relay statuses
    const intervalId = setInterval(loadRelays, 5000);

    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, []);

  // Handle adding a new relay
  const handleAddRelay = async () => {
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
      const success = await relayManager.addRelay(newRelayUrl);
      
      if (success) {
        toast({
          title: "Success",
          description: `Added relay ${newRelayUrl}`,
        });
        setNewRelayUrl('');
        
        // Update relay list
        setRelays(relayManager.getAllRelays());
      } else {
        toast({
          title: "Error",
          description: `Failed to add relay ${newRelayUrl}`,
          variant: "destructive"
        });
      }
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
    try {
      const success = await relayManager.removeRelay(url);
      
      if (success) {
        toast({
          title: "Success",
          description: `Removed relay ${url}`,
        });
        
        // Update relay list
        setRelays(relayManager.getAllRelays());
      } else {
        toast({
          title: "Error",
          description: `Failed to remove relay ${url}`,
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
    try {
      const success = await relayManager.updateRelay(url, read, write);
      
      if (success) {
        // Update relay list
        setRelays(relayManager.getAllRelays());
      } else {
        toast({
          title: "Error",
          description: `Failed to update relay ${url}`,
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
    try {
      // Remove all existing relays
      for (const relay of relays) {
        await relayManager.removeRelay(relay.url);
      }
      
      // Add default relays
      for (const url of DEFAULT_RELAYS) {
        await relayManager.addRelay(url);
      }
      
      toast({
        title: "Success",
        description: "Restored default relays",
      });
      
      // Update relay list
      setRelays(relayManager.getAllRelays());
    } catch (error) {
      console.error("Error restoring default relays:", error);
      toast({
        title: "Error",
        description: "Failed to restore default relays",
        variant: "destructive"
      });
    }
  };

  // Handle auto reconnect setting
  const handleAutoReconnectChange = (checked: boolean) => {
    setAutoReconnect(checked);
    relayManager.setAutoReconnect(checked);
    
    toast({
      title: "Settings Updated",
      description: `Auto reconnect ${checked ? 'enabled' : 'disabled'}`,
    });
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
        
        {/* Debug WebSocket Test Section */}
        <div className="border border-yellow-300 rounded-md p-4 bg-yellow-50 dark:bg-yellow-900/20 mb-4">
          <div className="flex items-center mb-2">
            <Bug className="h-4 w-4 mr-2 text-yellow-600" />
            <h3 className="text-sm font-medium text-yellow-600">WebSocket Connection Troubleshooting</h3>
          </div>
          <p className="text-xs text-yellow-600 mb-2">
            This utility tests whether WebSockets work in this environment. If this test fails but HTTP works, it indicates a WebSocket connectivity issue in the hosting environment.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium mb-2">1. Generic WebSocket Test</h4>
              <WebSocketTester />
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-2">2. Direct Nostr Relay Test</h4>
              <DirectNostrRelayTest />
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Switch 
              id="auto-reconnect" 
              checked={autoReconnect}
              onCheckedChange={handleAutoReconnectChange}
            />
            <Label htmlFor="auto-reconnect">Auto-reconnect to relays</Label>
          </div>
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