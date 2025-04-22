import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RefreshCw } from "lucide-react";
import logger from '@/lib/logger';

// This component tests a direct WebSocket connection to a Nostr relay
// without using the NDK library, to isolate the issue
export function DirectNostrRelayTest() {
  const [relayUrl, setRelayUrl] = useState<string>('wss://relay.damus.io');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  
  // Cleanup function to close WebSocket connection
  const cleanup = () => {
    if (socket) {
      try {
        socket.close();
      } catch (err) {
        console.error("Error closing socket:", err);
      }
      setSocket(null);
    }
  };
  
  // Clean up on unmount
  useEffect(() => {
    return cleanup;
  }, []);
  
  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toISOString().substring(11, 19)} - ${message}`]);
  };
  
  // Test a direct WebSocket connection to a Nostr relay
  const testDirectRelayConnection = () => {
    // Clean up any existing connection
    cleanup();
    
    // Reset status
    setStatus('connecting');
    setError(null);
    setLogs([]);
    
    addLog(`Testing direct connection to ${relayUrl}...`);
    
    try {
      // First check if WebSocket is available in this environment
      if (typeof WebSocket === 'undefined') {
        setStatus('error');
        setError('WebSocket is not available in this environment');
        addLog("ERROR: WebSocket is not available in this environment");
        logger.error("WebSocket is not available in this environment");
        return;
      }
      
      addLog(`WebSocket implementation: ${WebSocket.name || 'Native WebSocket'}`);
      
      // Create a new WebSocket connection directly to the relay
      const ws = new WebSocket(relayUrl);
      setSocket(ws);
      
      // Set a connection timeout
      const timeoutId = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          addLog("Connection timed out after 10 seconds");
          setStatus('error');
          setError('Connection timed out');
          ws.close();
        }
      }, 10000);
      
      ws.onopen = () => {
        clearTimeout(timeoutId);
        addLog("WebSocket connection OPENED successfully!");
        setStatus('connected');
        
        // Send a REQ message to request recent events
        const requestId = Math.random().toString(36).substring(2, 15);
        const reqMsg = JSON.stringify([
          "REQ", 
          requestId,
          {
            "kinds": [1],
            "limit": 1
          }
        ]);
        
        ws.send(reqMsg);
        addLog(`Sent REQ message: ${reqMsg}`);
      };
      
      ws.onmessage = (event) => {
        addLog(`Received message: ${event.data.substring(0, 100)}...`);
        
        try {
          // Try to parse the message
          const data = JSON.parse(event.data);
          if (data && data.length > 0) {
            addLog(`Message type: ${data[0]}`);
          }
        } catch (err) {
          addLog(`Error parsing message: ${err}`);
        }
      };
      
      ws.onerror = (event) => {
        clearTimeout(timeoutId);
        addLog("WebSocket ERROR occurred");
        console.error("Direct relay connection error", event);
        setStatus('error');
        setError('Connection error - see console for details');
      };
      
      ws.onclose = () => {
        clearTimeout(timeoutId);
        addLog("WebSocket connection CLOSED");
        if (status !== 'error') {
          // Only update status if not already in error state
          setStatus('idle');
        }
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setStatus('error');
      setError(errorMessage);
      addLog(`ERROR: ${errorMessage}`);
      logger.error("Direct relay connection exception", err);
    }
  };
  
  // Close the connection
  const closeConnection = () => {
    addLog("Manually closing connection...");
    cleanup();
    setStatus('idle');
  };
  
  return (
    <div className="p-4 border rounded-md">
      <h3 className="text-lg font-medium mb-4">Direct Nostr Relay Test</h3>
      <p className="text-sm text-gray-500 mb-4">
        This test attempts to connect directly to a Nostr relay without using the NDK library.
      </p>
      
      <div className="flex items-center space-x-2 mb-4">
        <span>Status:</span>
        {status === 'idle' && <Badge>Idle</Badge>}
        {status === 'connecting' && <Badge className="bg-yellow-500">Connecting...</Badge>}
        {status === 'connected' && <Badge className="bg-green-500">Connected</Badge>}
        {status === 'error' && <Badge className="bg-red-500">Error</Badge>}
      </div>
      
      {error && (
        <div className="text-red-500 mb-4">
          Error: {error}
        </div>
      )}
      
      <div className="flex space-x-2 mb-4">
        <Input
          value={relayUrl}
          onChange={(e) => setRelayUrl(e.target.value)}
          placeholder="wss://relay.example.com"
          className="flex-1"
        />
      </div>
      
      <div className="flex space-x-2 mb-4">
        <Button 
          onClick={testDirectRelayConnection} 
          disabled={status === 'connecting'}
          className="flex-1"
        >
          {status === 'connecting' && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
          Test Direct Connection
        </Button>
        
        {status === 'connected' && (
          <Button 
            variant="outline" 
            onClick={closeConnection}
          >
            Close Connection
          </Button>
        )}
      </div>
      
      <div className="mt-4 h-48 overflow-y-auto border p-2 rounded-md bg-gray-50 dark:bg-gray-900 text-xs font-mono">
        {logs.length > 0 ? (
          logs.map((log, i) => <div key={i}>{log}</div>)
        ) : (
          <div className="text-gray-400">Click "Test Direct Connection" to start the test</div>
        )}
      </div>
    </div>
  );
}