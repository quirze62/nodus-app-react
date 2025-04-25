import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { NdkProvider } from "@/contexts/NdkContext";
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
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
            <SimpleDebugPanel />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
