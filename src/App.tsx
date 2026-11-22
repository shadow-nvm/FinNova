import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { AppShell } from "./components/AppShell";
import { AuthPage } from "./pages/AuthPage";
import { BudgetsPage } from "./pages/BudgetsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { GoalsPage } from "./pages/GoalsPage";
import { LearnPage } from "./pages/LearnPage";
import { RemindersPage } from "./pages/RemindersPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TradeLabPage } from "./pages/TradeLabPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { DataProvider } from "./store/DataProvider";
import { PaperProvider } from "./store/PaperProvider";
import { SettingsProvider } from "./store/SettingsProvider";
import { ToastProvider } from "./components/ui";

function BootSplash() {
  return (
    <div className="auth-wrap">
      <div style={{ textAlign: "center" }}>
        <div className="brand-logo auth-loading-logo" aria-hidden="true">
          💠
        </div>
        <div className="muted">Restoring your session…</div>
      </div>
    </div>
  );
}

function RequireAuth() {
  const { user, authReady } = useAuth();
  if (!authReady) return <BootSplash />;
  if (!user) return <Navigate to="/auth" replace />;
  return <AppShell />;
}

function AuthRoute() {
  const { authReady } = useAuth();
  if (!authReady) return <BootSplash />;
  return <AuthPage />;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <SettingsProvider>
          <DataProvider>
            <PaperProvider>
              <Routes>
                <Route path="/auth" element={<AuthRoute />} />
                <Route path="/" element={<RequireAuth />}>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="transactions" element={<TransactionsPage />} />
                  <Route path="budgets" element={<BudgetsPage />} />
                  <Route path="goals" element={<GoalsPage />} />
                  <Route path="reminders" element={<RemindersPage />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="learn" element={<LearnPage />} />
                  <Route path="trade-lab" element={<TradeLabPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </PaperProvider>
          </DataProvider>
        </SettingsProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
