import { useOffline } from '@/hooks/useOffline';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function OfflineIndicator() {
  const { isOffline, syncWhenOnline } = useOffline();
  
  if (!isOffline) return null;
  
  const handleRetry = async () => {
    await syncWhenOnline();
  };

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 flex items-center">
      <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 mr-2" />
      <span className="text-sm text-yellow-800 dark:text-yellow-200">
        You're currently offline. Content will sync when you're back online.
      </span>
      <Button 
        variant="ghost"
        className="ml-auto text-sm text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200"
        onClick={handleRetry}
      >
        Retry
      </Button>
    </div>
  );
}
