import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Bug } from 'lucide-react';
import logger, { LogLevel, getRecentLogs } from '@/lib/logger';

export function SimpleDebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  
  const togglePanel = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      // When opening, set logger to DEBUG level
      logger.setLogLevel(LogLevel.DEBUG);
    }
  };
  
  const exportLogs = () => {
    const logsData = logger.exportLogs();
    // Create a blob and download it
    const blob = new Blob([logsData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nodus-logs-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const showLogs = () => {
    const logs = getRecentLogs(50, LogLevel.DEBUG);
    console.table(logs);
  };
  
  // Simple toggle button that logs to console
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end space-y-2">
      {isOpen && (
        <div className="bg-white dark:bg-gray-800 rounded-md shadow-lg p-4 mb-2 w-64 border border-gray-200 dark:border-gray-700">
          <h3 className="font-medium mb-3">Debug Tools</h3>
          <div className="space-y-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full" 
              onClick={showLogs}
            >
              Show Logs in Console
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full" 
              onClick={exportLogs}
            >
              Export Logs
            </Button>
            <div className="text-xs mt-2 text-gray-500">
              Connection troubleshooting info will appear in browser console.
            </div>
          </div>
        </div>
      )}
      <Button 
        variant="outline" 
        size="sm" 
        onClick={togglePanel}
        className={isOpen ? "bg-blue-100 dark:bg-blue-900" : ""}
      >
        <Bug className="mr-2 h-4 w-4" />
        Debug
      </Button>
    </div>
  );
}