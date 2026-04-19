import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import AgentList from "@/pages/AgentList";
import NotFound from "@/pages/NotFound";

const AgentUpload = lazy(() => import("@/pages/AgentUpload"));
const AgentDetail = lazy(() => import("@/pages/AgentDetail"));
const AgentSchema = lazy(() => import("@/pages/AgentSchema"));
const TestCaseGenerate = lazy(() => import("@/pages/TestCaseGenerate"));
const TestCaseDetail = lazy(() => import("@/pages/TestCaseDetail"));
const EvalRunHistory = lazy(() => import("@/pages/EvalRunHistory"));
const RegressionDashboard = lazy(() => import("@/pages/RegressionDashboard"));
const TestCaseAgentList = lazy(() => import("@/pages/TestCaseAgentList"));
const VersionDiff = lazy(() => import("@/pages/VersionDiff"));

const queryClient = new QueryClient();

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-12 text-muted-foreground">
      <Loader2 className="w-4 h-4 animate-spin" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <Toaster />
      <BrowserRouter>
        <AppLayout>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Navigate to="/agents" replace />} />
              <Route path="/agents" element={<AgentList />} />
              <Route path="/agents/new" element={<AgentUpload />} />
              <Route path="/agents/:id" element={<AgentDetail />} />
              <Route path="/agents/:id/diff" element={<VersionDiff />} />
              <Route path="/agents/:agentId/versions/:versionId/schema" element={<AgentSchema />} />
              <Route path="/agents/:agentId/versions/:versionId/test-cases/generate" element={<TestCaseGenerate />} />

              <Route path="/test-cases" element={<TestCaseAgentList />} />

              <Route path="/agents/:agentId/test-cases/:id" element={<TestCaseDetail />} />
              <Route path="/test-cases/:id" element={<TestCaseDetail />} />
              <Route path="/eval-runs" element={<EvalRunHistory />} />
              <Route path="/regression" element={<RegressionDashboard />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
