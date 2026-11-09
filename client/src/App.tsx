import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Apply from "./pages/Apply";

function Router() {
  return (
    <Switch>
      <Route path="/apply" component={Apply} />
      <Route path="/apply/:jobId" component={Apply} />
      <Route path="/" component={Home} />
      <Route path="/candidates" component={Home} />
      <Route path="/jobs" component={Home} />
      <Route path="/pipeline" component={Home} />
      <Route path="/interviews" component={Home} />
      <Route path="/questions" component={Home} />
      <Route path="/evaluations" component={Home} />
      <Route path="/integrations" component={Home} />
      <Route path="/notifications" component={Home} />
      <Route path="/settings" component={Home} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-center" richColors />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
