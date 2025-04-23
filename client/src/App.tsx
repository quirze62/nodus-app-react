import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import MobileNavigation from "@/components/layout/MobileNavigation";
import AuthForm from "@/components/auth/AuthForm";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Profile from "@/pages/Profile";
import Messages from "@/pages/Messages";
import Settings from "@/pages/Settings";
import { queryClient } from "./lib/queryClient";
import { SimpleDebugPanel } from "@/components/common/SimpleDebugPanel";

function MainLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <AuthForm />;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
          {children}
        </main>
      </div>
      <MobileNavigation />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => (
        <MainLayout>
          <Home />
        </MainLayout>
      )} />
      <Route path="/profile" component={() => (
        <MainLayout>
          <Profile />
        </MainLayout>
      )} />
      <Route path="/messages" component={() => (
        <MainLayout>
          <Messages />
        </MainLayout>
      )} />
      <Route path="/settings" component={() => (
        <MainLayout>
          <Settings />
        </MainLayout>
      )} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [isMigratedToSvelte, setIsMigratedToSvelte] = useState(false);
  
  // Check if the user wants to view the Svelte version
  useEffect(() => {
    const preferSvelte = localStorage.getItem('preferSvelte') === 'true';
    setIsMigratedToSvelte(preferSvelte);
  }, []);
  
  // If user has opted for Svelte, show a message with a link to the Svelte app
  if (isMigratedToSvelte) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-white dark:bg-gray-900">
        <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
          <h1 className="text-3xl font-bold text-blue-600 mb-4">Nodus App</h1>
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            We've migrated to a new Svelte implementation! You're currently viewing the legacy React version.
          </p>
          <div className="space-y-4">
            <a 
              href="http://localhost:5173" 
              target="_blank" 
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              Open Svelte Version
            </a>
            <button 
              onClick={() => {
                localStorage.removeItem('preferSvelte');
                setIsMigratedToSvelte(false);
              }}
              className="block w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-3 px-4 rounded-lg transition-colors"
            >
              Continue with React Version
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
            <SimpleDebugPanel />
            <div className="fixed bottom-4 right-4 z-50">
              <button
                onClick={() => {
                  localStorage.setItem('preferSvelte', 'true');
                  setIsMigratedToSvelte(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition-colors"
              >
                Try Svelte Version
              </button>
            </div>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
