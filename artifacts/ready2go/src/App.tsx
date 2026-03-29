import React from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";

import Login from "./pages/login";
import Dashboard from "./pages/dashboard";
import TripDetails from "./pages/trip-details";
import NotFound from "./pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const LoadingScreen = () => (
  <div
    className="min-h-screen flex items-center justify-center"
    style={{ background: "linear-gradient(135deg,#e0f2fe 0%,#ede9fe 50%,#dbeafe 100%)" }}
  >
    <div className="w-8 h-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
  </div>
);

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", err, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center"
          style={{ background: "linear-gradient(135deg,#e0f2fe 0%,#ede9fe 50%,#dbeafe 100%)" }}
        >
          <p className="text-lg font-semibold text-slate-700">Oups, quelque chose s'est mal passé.</p>
          <button
            className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium"
            onClick={() => { this.setState({ hasError: false }); window.location.href = "/"; }}
          >
            Retour à l'accueil
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { userId, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!userId) return <Redirect to="/login" />;
  return <Component />;
}

function LoginRoute() {
  const { userId, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (userId) return <Redirect to="/" />;
  return <Login />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginRoute} />
      <Route path="/">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/voyage/:id">
        {() => <ProtectedRoute component={TripDetails} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <ErrorBoundary>
              <Router />
            </ErrorBoundary>
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
