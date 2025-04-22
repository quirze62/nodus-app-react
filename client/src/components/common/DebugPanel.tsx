import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { getRecentLogs, LogLevel, setLogLevel } from '@/lib/logger';
import { useToast } from '@/hooks/use-toast';
import { Bug, Copy } from 'lucide-react';

export function DebugPanel() {
  const [logs, setLogs] = useState<any[]>([]);
  const [filterLevel, setFilterLevel] = useState<LogLevel>(LogLevel.INFO);
  const [open, setOpen] = useState(false);
  const [isDeployedSite, setIsDeployedSite] = useState(false);
  const { toast } = useToast();

  // Check if we're on a deployed site
  useEffect(() => {
    setIsDeployedSite(
      window.location.hostname.includes('.replit.app') || 
      window.location.hostname.includes('.repl.co')
    );
  }, []);

  // Refresh logs when dialog is opened or filter changes
  useEffect(() => {
    if (!open) return;
    
    const updateLogs = () => {
      setLogs(getRecentLogs(100, filterLevel));
    };
    
    updateLogs();
    const interval = setInterval(updateLogs, 1000);
    
    return () => clearInterval(interval);
  }, [open, filterLevel]);

  // Get badge color based on log level
  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'DEBUG': return <Badge className="bg-gray-500">DEBUG</Badge>;
      case 'INFO': return <Badge className="bg-blue-500">INFO</Badge>;
      case 'WARN': return <Badge className="bg-yellow-500">WARN</Badge>;
      case 'ERROR': return <Badge className="bg-red-500">ERROR</Badge>;
      default: return <Badge>{level}</Badge>;
    }
  };

  // Copy logs to clipboard
  const copyLogs = () => {
    const logText = JSON.stringify(logs, null, 2);
    navigator.clipboard.writeText(logText).then(() => {
      toast({
        title: "Copied!",
        description: "Debug logs copied to clipboard",
      });
    });
  };

  // Handle filter level change
  const handleLevelChange = (value: string) => {
    setFilterLevel(LogLevel[value as keyof typeof LogLevel]);
  };

  // Set runtime log level
  const handleRuntimeLevelChange = (value: string) => {
    setLogLevel(LogLevel[value as keyof typeof LogLevel]);
    toast({
      title: "Log Level Changed",
      description: `Set runtime log level to ${value}`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="fixed bottom-4 right-4 z-50">
          <Bug className="mr-2 h-4 w-4" />
          Debug
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Debug Info</DialogTitle>
          <DialogDescription>
            Connection and logging information for troubleshooting.
            {isDeployedSite && (
              <div className="mt-2 text-amber-500">
                Note: This is a deployed site. WebSocket connections should work correctly.
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4">
          <div className="flex justify-between">
            <div className="flex items-center gap-4">
              <div>
                <label className="text-sm font-medium">Filter Level:</label>
                <Select onValueChange={handleLevelChange} defaultValue="INFO">
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEBUG">DEBUG</SelectItem>
                    <SelectItem value="INFO">INFO</SelectItem>
                    <SelectItem value="WARN">WARN</SelectItem>
                    <SelectItem value="ERROR">ERROR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium">Runtime Level:</label>
                <Select onValueChange={handleRuntimeLevelChange} defaultValue="INFO">
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEBUG">DEBUG</SelectItem>
                    <SelectItem value="INFO">INFO</SelectItem>
                    <SelectItem value="WARN">WARN</SelectItem>
                    <SelectItem value="ERROR">ERROR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Button variant="outline" size="sm" onClick={copyLogs}>
              <Copy className="mr-2 h-4 w-4" />
              Copy Logs
            </Button>
          </div>
          
          <ScrollArea className="h-72 rounded-md border p-4">
            {logs.length > 0 ? (
              <div className="space-y-3">
                {logs.map((log, i) => (
                  <div key={i} className="text-sm">
                    <div className="flex items-center gap-2">
                      {getLevelBadge(log.level)}
                      <span className="text-xs text-gray-500">{log.timestamp}</span>
                    </div>
                    <div className="font-medium mt-1">{log.message}</div>
                    {log.data && (
                      <pre className="mt-1 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                        {typeof log.data === 'object'
                          ? JSON.stringify(log.data, null, 2)
                          : String(log.data)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No logs at the selected level
              </div>
            )}
          </ScrollArea>
          
          <div className="text-xs text-gray-500">
            <strong>Environment:</strong> {import.meta.env.MODE}
            <br />
            <strong>User Agent:</strong> {navigator.userAgent}
          </div>
        </div>
        
        <DialogFooter>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}