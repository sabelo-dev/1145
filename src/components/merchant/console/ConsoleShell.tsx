import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, Boxes, Download, ExternalLink, Loader2, LogOut, MonitorSmartphone, QrCode, Sparkles, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isNative } from "@/lib/native";
import { cn } from "@/lib/utils";
import { useMerchantAccess } from "@/hooks/useMerchantAccess";
import { canUse, ROLE_LABELS, type StoreAccess } from "@/services/merchantAi";
import MerchantOrderConsole from "@/components/merchant/dashboard/MerchantOrderConsole";
import StoreSwitcher from "@/components/merchant/dashboard/StoreSwitcher";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

// Orders loads with the app (it carries the new-order alert); other tabs load
// when first opened, so a cashier's tablet doesn't download charts it never shows.
const ConsoleStock = lazyWithRetry(() => import("./ConsoleStock"));
const MerchantPaymentRequests = lazyWithRetry(() => import("@/components/merchant/dashboard/MerchantPaymentRequests"));
const MerchantStoreAnalytics = lazyWithRetry(() => import("@/components/merchant/dashboard/MerchantStoreAnalytics"));
const MerchantAssistant = lazyWithRetry(() => import("@/components/merchant/dashboard/MerchantAssistant"));
const MerchantTeam = lazyWithRetry(() => import("@/components/merchant/dashboard/MerchantTeam"));

type TabId = "orders" | "stock" | "pay" | "insights" | "assistant" | "team";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

const TAB_KEY = "1145.console-tab";

/** The tabs this person may use in this store: their role's permissions and the features switched on. */
function tabsFor(access: StoreAccess | undefined): Tab[] {
  if (!access) return [];
  const tabs: Tab[] = [];
  if (canUse(access, "orders", "order_console")) tabs.push({ id: "orders", label: "Orders", icon: MonitorSmartphone });
  if (canUse(access, "operations")) tabs.push({ id: "stock", label: "Stock", icon: Boxes });
  if (canUse(access, "payments", "payment_requests")) tabs.push({ id: "pay", label: "Pay", icon: QrCode });
  if (canUse(access, "insights")) tabs.push({ id: "insights", label: "Insights", icon: BarChart3 });
  if (access.features.includes("ai_assistant") && (canUse(access, "insights") || canUse(access, "catalog"))) {
    tabs.push({ id: "assistant", label: "Ask 1145 AI", icon: Sparkles });
  }
  if (canUse(access, "settings") && access.features.length > 0) tabs.push({ id: "team", label: "Team", icon: Users });
  return tabs;
}

interface ConsoleShellProps {
  app: { canInstall: boolean; showIosHint: boolean; install: () => Promise<void> };
}

/**
 * The "1145 Orders" app: a left menu with every tab the signed-in owner or
 * staff member has access to in the chosen store, and the tab's content
 * beside it. On narrow screens the menu becomes a row of tabs at the top.
 *
 * The order console stays mounted on every tab, so new orders keep being
 * checked and the green alert and alarm still appear while someone is on
 * 1145 Pay or the assistant.
 */
const ConsoleShell: React.FC<ConsoleShellProps> = ({ app }) => {
  const { user, logout } = useAuth();
  const { stores, current, setStoreId, isLoading } = useMerchantAccess();
  const tabs = useMemo(() => tabsFor(current), [current]);
  const [waiting, setWaiting] = useState(0);
  const [tab, setTab] = useState<TabId>(() => {
    try { return (localStorage.getItem(TAB_KEY) as TabId) || "orders"; } catch { return "orders"; }
  });

  // Fall back to the first tab this person has when the remembered one isn't available here.
  const active: TabId | undefined = tabs.some((t) => t.id === tab) ? tab : tabs[0]?.id;
  useEffect(() => {
    if (active) {
      try { localStorage.setItem(TAB_KEY, active); } catch { /* storage unavailable */ }
    }
  }, [active]);

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!current || tabs.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="space-y-4 p-8 text-center text-muted-foreground">
            <p>
              {stores.length === 0
                ? "This account is not linked to a store. Ask the store owner to add you under Team."
                : "Nothing in 1145 Orders is switched on for this store yet, or your role doesn't include it."}
            </p>
            {stores.length > 1 && current && (
              <div className="flex justify-center"><StoreSwitcher stores={stores} current={current} onChange={setStoreId} /></div>
            )}
            <Button variant="outline" onClick={() => void logout()}>Sign in with another account</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isOwner = current.role === "owner";
  const hasOrders = tabs.some((t) => t.id === "orders");

  const navButton = (t: Tab, compact: boolean) => (
    <button
      key={t.id}
      type="button"
      onClick={() => setTab(t.id)}
      aria-current={active === t.id ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md text-left font-medium transition-colors",
        compact ? "shrink-0 px-3 py-2 text-sm" : "w-full px-3 py-3 text-base",
        active === t.id ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
      )}
    >
      <t.icon className="h-5 w-5 shrink-0" aria-hidden />
      <span className="flex-1">{t.label}</span>
      {t.id === "orders" && waiting > 0 && (
        <Badge variant={active === t.id ? "secondary" : "default"} className="ml-auto" aria-label={`${waiting} new orders`}>
          {waiting}
        </Badge>
      )}
    </button>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      {/* Left menu (tablets in landscape and larger) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-muted/30 md:flex md:sticky md:top-0 md:h-screen">
        <div className="space-y-3 border-b p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">1145 Orders</p>
          <div>
            <p className="truncate text-lg font-semibold">{current.store_name}</p>
            <p className="text-sm text-muted-foreground">{ROLE_LABELS[current.role]}</p>
          </div>
          {stores.length > 1 && <StoreSwitcher stores={stores} current={current} onChange={setStoreId} />}
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Console">
          {tabs.map((t) => navButton(t, false))}
          {isOwner && !isNative() && (
            <a href="/merchant/dashboard"
              className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-base font-medium text-muted-foreground hover:bg-muted">
              <ExternalLink className="h-5 w-5 shrink-0" aria-hidden /> Merchant dashboard
            </a>
          )}
        </nav>
        <div className="space-y-2 border-t p-3">
          {app.canInstall && (
            <Button variant="outline" className="w-full gap-2" onClick={() => void app.install()}>
              <Download className="h-4 w-4" /> Install app
            </Button>
          )}
          {app.showIosHint && (
            <p className="text-xs text-muted-foreground">To install: tap Share, then “Add to Home Screen”.</p>
          )}
          <p className="truncate px-1 text-xs text-muted-foreground" title={user?.email}>{user?.email}</p>
          <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => void logout()}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Top bar with tabs (phones and tablets in portrait) */}
      <header className="sticky top-0 z-30 border-b bg-background md:hidden">
        <div className="flex items-center gap-2 px-3 pt-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{current.store_name}</p>
            <p className="text-xs text-muted-foreground">{ROLE_LABELS[current.role]}</p>
          </div>
          {app.canInstall && (
            <Button variant="outline" size="icon" onClick={() => void app.install()} aria-label="Install app">
              <Download className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => void logout()} aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        {stores.length > 1 && <div className="px-3 pt-2"><StoreSwitcher stores={stores} current={current} onChange={setStoreId} /></div>}
        <nav className="flex gap-1 overflow-x-auto px-3 py-2" aria-label="Console">
          {tabs.map((t) => navButton(t, true))}
        </nav>
      </header>

      <main className="min-w-0 flex-1 p-3 md:p-5">
        {/* Always mounted when the role has orders, so alerts work on every tab */}
        {hasOrders && (
          <MerchantOrderConsole standalone inShell boardVisible={active === "orders"} onWaitingChange={setWaiting} />
        )}
        <React.Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
        {active === "stock" && <ConsoleStock storeId={current.store_id} />}
        {active === "pay" && <MerchantPaymentRequests />}
        {active === "insights" && (
          <MerchantStoreAnalytics storeId={current.store_id}
            onNavigate={(target) => setTab(target === "inventory" ? "stock" : "orders")} />
        )}
        {active === "assistant" && <MerchantAssistant />}
        {active === "team" && <MerchantTeam />}
        </React.Suspense>
      </main>
    </div>
  );
};

export default ConsoleShell;
