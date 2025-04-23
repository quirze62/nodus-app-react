import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import logger from '@/lib/logger';

// This component tests a basic WebSocket connection to see if WebSockets work at all
export function WebSocketTester() {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  
  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toISOString().substring(11, 19)} - ${message}`]);
  };
  
  // Test WebSocket connection to echo.websocket.org (a common WebSocket test server)
  const testWebSocket = () => {
    setStatus('connecting');
    setError(null);
    addLog("Starting WebSocket test...");
    
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
      
      // Try to connect to a public WebSocket echo server
      const testSocket = new WebSocket('wss://echo.websocket.org');
      
      testSocket.onopen = () => {
        addLog("WebSocket connection OPENED successfully!");
        setStatus('connected');
        
        // Send a test message
        testSocket.send('Hello, WebSocket!');
        addLog("Sent test message");
        
        // Close after 5 seconds
        setTimeout(() => {
          addLog("Closing connection after 5 seconds");
          testSocket.close();
        }, 5000);
      };
      
      testSocket.onmessage = (event) => {
        addLog(`Received message: ${event.data}`);
      };
      
      testSocket.onerror = (event) => {
        addLog("WebSocket ERROR occurred");
        logger.error("WebSocket test error", event);
        setStatus('error');
        setError('Connection error - see console for details');
      };
      
      testSocket.onclose = () => {
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
      logger.error("WebSocket test exception", err);
    }
  };
  
  // Try alternate test using fetch to a proxy
  const testHttpFallback = async () => {
    addLog("Testing HTTP fallback...");
    try {
      const response = await fetch('https://httpbin.org/get?test=websocket');
      const data = await response.json();
      addLog(`HTTP fallback successful: ${JSON.stringify(data).substring(0, 50)}...`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      addLog(`HTTP fallback error: ${errorMessage}`);
    }
  };
  
  return (
    <div className="p-4 border rounded-md">
      <h3 className="text-lg font-medium mb-4">WebSocket Connectivity Test</h3>
      
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
        <Button onClick={testWebSocket} disabled={status === 'connecting'}>
          Test WebSocket
        </Button>
        
        <Button variant="outline" onClick={testHttpFallback}>
          Test HTTP Fallback
        </Button>
      </div>
      
      <div className="mt-4 h-48 overflow-y-auto border p-2 rounded-md bg-gray-50 dark:bg-gray-900 text-xs font-mono">
        {logs.length > 0 ? (
          logs.map((log, i) => <div key={i}>{log}</div>)
        ) : (
          <div className="text-gray-400">Click "Test WebSocket" to start the test</div>
        )}
      </div>
    </div>
  );
}