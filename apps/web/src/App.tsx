import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { useAuthStore } from "./lib/store";
import { AnomaliesPage } from "./pages/AnomaliesPage";
import { BudgetsPage } from "./pages/BudgetsPage";
import { LoginPage } from "./pages/LoginPage";
import { OverviewPage } from "./pages/OverviewPage";
import { RecommendationsPage } from "./pages/RecommendationsPage";
import { RegisterPage } from "./pages/RegisterPage";

const queryClient = new QueryClient();

function Protected() {
  const token = useAuthStore((state) => state.token);
  return token ? <AppShell /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<Protected />}>
          <Route index element={<OverviewPage />} />
          <Route path="anomalies" element={<AnomaliesPage />} />
          <Route path="budgets" element={<BudgetsPage />} />
          <Route path="recommendations" element={<RecommendationsPage />} />
        </Route>
      </Routes>
    </QueryClientProvider>
  );
}