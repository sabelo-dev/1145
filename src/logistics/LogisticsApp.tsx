import React, { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LogisticsAuthProvider, useLogisticsAuth } from "./auth/LogisticsAuth";
import LogisticsLayout from "./layout/LogisticsLayout";
import { FullScreenSpinner } from "./components/common";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const NoAccessPage = lazy(() => import("./pages/NoAccessPage"));
const OverviewPage = lazy(() => import("./pages/OverviewPage"));
const ShipmentsPage = lazy(() => import("./pages/ShipmentsPage"));
const DispatchPage = lazy(() => import("./pages/DispatchPage"));
const RoutesPage = lazy(() => import("./pages/RoutesPage"));
const RouteDetailPage = lazy(() => import("./pages/RouteDetailPage"));
const HubsPage = lazy(() => import("./pages/HubsPage"));
const FleetPage = lazy(() => import("./pages/FleetPage"));
const DriversPage = lazy(() => import("./pages/DriversPage"));
const TeamPage = lazy(() => import("./pages/TeamPage"));
const ScanPage = lazy(() => import("./pages/ScanPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const DevelopersPage = lazy(() => import("./pages/DevelopersPage"));
const SecurityPage = lazy(() => import("./pages/SecurityPage"));
const CodPage = lazy(() => import("./pages/CodPage"));
const AccountsPage = lazy(() => import("./pages/AccountsPage"));
const MfaPage = lazy(() => import("./pages/MfaPage"));
const TrackPage = lazy(() => import("./pages/TrackPage"));
const PortalApp = lazy(() => import("./portal/PortalApp"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
  },
});

function RequireStaff() {
  const { session, role, needsMfa, accounts, loading } = useLogisticsAuth();
  const location = useLocation();
  if (loading) return <FullScreenSpinner />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (needsMfa) return <Navigate to="/mfa" replace />;
  if (!role && accounts.length) return <Navigate to="/portal" replace />;
  if (!role) return <Navigate to="/no-access" replace />;
  return (
    <LogisticsLayout>
      <Outlet />
    </LogisticsLayout>
  );
}

export default function LogisticsApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LogisticsAuthProvider>
          <BrowserRouter basename={import.meta.env.VITE_LOGISTICS_BASE_PATH || "/"}>
            <Suspense fallback={<FullScreenSpinner />}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/no-access" element={<NoAccessPage />} />
                <Route path="/mfa" element={<MfaPage />} />
                <Route path="/portal/*" element={<PortalApp />} />
                <Route path="/track" element={<TrackPage />} />
                <Route path="/track/:trackingNumber" element={<TrackPage />} />
                <Route element={<RequireStaff />}>
                  <Route index element={<OverviewPage />} />
                  <Route path="/shipments" element={<ShipmentsPage />} />
                  <Route path="/dispatch" element={<DispatchPage />} />
                  <Route path="/routes" element={<RoutesPage />} />
                  <Route path="/routes/:routeId" element={<RouteDetailPage />} />
                  <Route path="/scan" element={<ScanPage />} />
                  <Route path="/hubs" element={<HubsPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/fleet" element={<FleetPage />} />
                  <Route path="/drivers" element={<DriversPage />} />
                  <Route path="/team" element={<TeamPage />} />
                  <Route path="/developers" element={<DevelopersPage />} />
                  <Route path="/security" element={<SecurityPage />} />
                  <Route path="/cod" element={<CodPage />} />
                  <Route path="/accounts" element={<AccountsPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <Toaster />
        </LogisticsAuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
