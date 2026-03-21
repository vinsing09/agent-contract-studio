import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import AgentUpload from "@/pages/AgentUpload";
import AgentList from "@/pages/AgentList";
import TestCaseList from "@/pages/TestCaseList";
import TestCaseDetail from "@/pages/TestCaseDetail";
import EvalRunHistory from "@/pages/EvalRunHistory";
import RegressionDashboard from "@/pages/RegressionDashboard";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Navigate to="/agents/new" replace />} />
            <Route path="/agents" element={<AgentList />} />
            <Route path="/agents/new" element={<AgentUpload />} />
            <Route path="/agents/:agentId/test-cases" element={<TestCaseList />} />
            <Route path="/test-cases/:id" element={<TestCaseDetail />} />
            <Route path="/eval-runs" element={<EvalRunHistory />} />
            <Route path="/regression" element={<RegressionDashboard />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
