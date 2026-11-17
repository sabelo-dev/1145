import React, { createContext, lazy, Suspense, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { BarChart3, Building2, Code2, FileText, LayoutDashboard, LogOut, Package, PlusCircle, Settings, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useLogisticsAuth, type PortalAccount } from "../auth/LogisticsAuth";
import { FullScreenSpinner, Spinner } from "../components/common";

const PortalOverview = lazy(() => import("./PortalOverview"));
const PortalShipments = lazy(() => import("./PortalShipments"));
const PortalBook = lazy(() => import("./PortalBook"));
const PortalInvoices = lazy(() => import("./PortalInvoices"));
const PortalDevelopers = lazy(() => import("./PortalDevelopers"));
const PortalTeam = lazy(() => import("./PortalTeam"));
const PortalReports = lazy(() => import("./PortalReports"));
const PortalSettings = lazy(() => import("./PortalSettings"));

interface PortalCtx {
  account: PortalAccount;
  isAdmin: boolean;
}
const Ctx = createContext<PortalCtx | undefined>(undefined);
export const usePortal = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePortal outside PortalApp");
  return v;
};

const STORAGE_KEY = "lx-portal-account";

const PortalApp: React.FC = () => {
  const { session, accounts, loading, signOut, role } = useLogisticsAuth();
  const [accountId, setAccountId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const account = useMemo(() => accounts.find((a) => a.id === accountId) ?? accounts[0], [accounts, accountId]);

  useEffect(() => {
    try {
      if (account) localStorage.setItem(STORAGE_KEY, account.id);
    } catch {
      /* storage unavailable */
    }
  }, [account]);

  if (loading) return <FullScreenSpinner />;
  if (!session) return <Navigate to="/login" replace />;
  if (!account) return <Navigate to={role ? "/" : "/no-access"} replace />;
  const isAdmin = account.role === "admin";

  const nav = [
    { to: "/portal", label: "Overview", icon: LayoutDashboard, end: true },
    { to: "/portal/shipments", label: "Shipments", icon: Package },
    { to: "/portal/book", label: "Book a delivery", icon: PlusCircle },
    { to: "/portal/reports", label: "Performance", icon: BarChart3 },
    ...(isAdmin
      ? [
          { to: "/portal/invoices", label: "Invoices", icon: FileText },
          { to: "/portal/developers", label: "API & webhooks", icon: Code2 },
          { to: "/portal/team", label: "Team", icon: Users },
          { to: "/portal/settings", label: "Settings", icon: Settings },
        ]
      : []),
  ];

  return (
    <Ctx.Provider value={{ account, isAdmin }}>
      <div className="min-h-screen bg-muted/30">
        <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
            <div className="h-7 w-7 rounded-md bg-primary text-primary-foreground grid place-items-center text-xs font-bold">LX</div>
            <span className="font-semibold hidden sm:inline">1145 Logistics</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">Business</span>
            <div className="ml-auto flex items-center gap-2">
              {accounts.length > 1 ? (
                <Select value={account.id} onValueChange={setAccountId}>
                  <SelectTrigger className="h-9 w-52">
                    <Building2 className="h-4 w-4 mr-1.5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-sm font-medium flex items-center gap-1.5">
                  <Building2 className="h-4 w-4" /> {account.name}
                </span>
              )}
              {role && (
                <Button variant="ghost" size="sm" asChild>
                  <a href={import.meta.env.BASE_URL}>Ops console</a>
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <nav className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
            {nav.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm",
                    isActive ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground",
                  )
                }
              >
                <Icon className="h-4 w-4" /> {label}
              </NavLink>
            ))}
          </nav>
        </header>
        {account.status === "on_hold" && (
          <div className="bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100 text-sm text-center px-4 py-2">
            This account is on hold, so new bookings are paused. Please contact accounts.
          </div>
        )}
        <main className="max-w-6xl mx-auto p-4 sm:p-6">
          <Suspense
            fallback={
              <div className="flex justify-center py-16">
                <Spinner />
              </div>
            }
          >
            <Routes>
              <Route index element={<PortalOverview />} />
              <Route path="shipments" element={<PortalShipments />} />
              <Route path="book" element={<PortalBook />} />
              <Route path="reports" element={<PortalReports />} />
              {isAdmin && <Route path="invoices" element={<PortalInvoices />} />}
              {isAdmin && <Route path="developers" element={<PortalDevelopers />} />}
              {isAdmin && <Route path="team" element={<PortalTeam />} />}
              {isAdmin && <Route path="settings" element={<PortalSettings />} />}
              <Route path="*" element={<Navigate to="/portal" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </Ctx.Provider>
  );
};

export default PortalApp;
