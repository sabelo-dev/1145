import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Bell, BellOff, Plus } from "lucide-react";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EateryDetailsForm from "@/components/eatery/EateryDetailsForm";
import EateryMenuManager from "@/components/eatery/EateryMenuManager";
import EateryOrders from "@/components/eatery/EateryOrders";
import EateryOverview, { type EateryTab } from "@/components/eatery/EateryOverview";
import { useAuth } from "@/contexts/AuthContext";
import { useNewOrderAlert } from "@/hooks/useNewOrderAlert";
import { fetchEateryOrders, fetchMenu, fetchMyEateries, registerEatery, updateEatery, watchEateryOrders } from "@/services/food";

const STATUS_NOTE = {
  pending: "Your eatery is waiting for 1145 to review it. You can build your menu in the meantime; customers will see it once it's approved.",
  suspended: "This eatery has been suspended and is hidden from customers. Contact 1145 support for help.",
} as const;

const STATUS_LABEL = { pending: "Awaiting review", approved: "Approved", suspended: "Suspended" } as const;

/** Where an eatery owner registers, edits their listing and menu, and handles orders. */
const EateryDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["my-eateries", user?.id];
  const { data: eateries, isLoading, isError } = useQuery({ queryKey, queryFn: () => fetchMyEateries(user!.id), enabled: !!user, staleTime: 0, retry: false });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState<EateryTab>("overview");

  const eatery = eateries?.find((e) => e.id === selectedId) ?? eateries?.[0];
  const eateryId = eatery?.id;

  // Shared with the Orders and Menu tabs (same query keys), so everything stays in step.
  const { data: orders } = useQuery({
    queryKey: ["eatery-orders", eateryId], queryFn: () => fetchEateryOrders(eateryId!), enabled: !!eateryId, staleTime: 0,
    refetchInterval: 60_000, // safety net in case the live connection drops
  });
  const { data: menu } = useQuery({ queryKey: ["eatery-menu", eateryId], queryFn: () => fetchMenu(eateryId!), enabled: !!eateryId, staleTime: 0 });

  // Live order updates for the whole dashboard, whichever tab is open.
  useEffect(() => {
    if (!eateryId) return;
    return watchEateryOrders(eateryId, () => { void queryClient.invalidateQueries({ queryKey: ["eatery-orders", eateryId] }); });
  }, [eateryId, queryClient]);

  const waitingIds = useMemo(() => orders?.filter((o) => o.status === "placed").map((o) => o.id), [orders]);
  const { soundOn, toggleSound } = useNewOrderAlert(waitingIds, (count) => {
    toast.success(count === 1 ? "New order received" : `${count} new orders received`, {
      action: { label: "View", onClick: () => setTab("orders") },
      duration: 15_000,
    });
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey });

  if (isLoading || !user) {
    return <div className="page-container py-10" aria-busy><Skeleton className="h-10 w-72" /><Skeleton className="mt-6 h-72 w-full rounded-2xl" /></div>;
  }

  if (isError) {
    return (
      <div className="page-container max-w-2xl py-16 text-center">
        <h1 className="type-title">The eatery dashboard isn't available yet</h1>
        <p className="mt-3 text-text-secondary">We couldn't load your eatery details. Please try again shortly, or contact 1145 support if this continues.</p>
        <Button variant="outline" className="mt-5 rounded-full" onClick={() => refresh()}>Try again</Button>
      </div>
    );
  }

  // First visit, or adding another location: the registration form.
  if (!eatery || adding) {
    return (
      <div className="min-h-screen bg-background">
        <SEO title="List your eatery | 1145" noindex />
        <div className="page-container max-w-3xl py-8 md:py-12">
          <p className="eyebrow text-text-secondary">1145 Food Court</p>
          <h1 className="type-headline mt-2">List your eatery on 1145.</h1>
          <p className="type-lead mt-3 text-text-secondary">
            Tell us about your eatery. Once 1145 has reviewed it, you can switch on orders and customers can find you in the Food Court.
          </p>
          <ol className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
            {["Add your eatery's details", "Build your menu while we review", "Switch on orders and start cooking"].map((step, index) => (
              <li key={step} className="flex items-center gap-3 rounded-2xl bg-surface-muted p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-900 text-sm font-semibold text-white tabular-nums">{index + 1}</span>
                <span className="text-foreground">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-8">
            <EateryDetailsForm
              submitLabel="Submit for review"
              onSubmit={async (details) => {
                const created = await registerEatery(user.id, details);
                await refresh();
                setSelectedId(created.id);
                setAdding(false);
                setTab("menu");
                toast.success("Eatery submitted. Add your menu while we review it.");
              }}
            />
          </div>
          {adding && <Button variant="ghost" className="mt-4" onClick={() => setAdding(false)}>Cancel</Button>}
        </div>
      </div>
    );
  }

  const approved = eatery.status === "approved";
  const waiting = waitingIds?.length ?? 0;

  const toggleOrders = async (accepting: boolean) => {
    try {
      await updateEatery(eatery.id, { accepting_orders: accepting });
      await refresh();
      toast.success(accepting ? "You're now taking orders" : "Orders paused");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't change that. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO title={`${eatery.name} | Eatery dashboard | 1145`} noindex />
      <div className="page-container py-8 md:py-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow text-text-secondary">Eatery dashboard</p>
            {eateries && eateries.length > 1 ? (
              <Select value={eatery.id} onValueChange={(id) => { setSelectedId(id); setTab("overview"); }}>
                <SelectTrigger aria-label="Choose eatery" className="mt-2 h-12 w-72 max-w-full text-lg font-semibold"><SelectValue /></SelectTrigger>
                <SelectContent>{eateries.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <h1 className="type-headline mt-2">{eatery.name}</h1>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
              <span className={approved
                ? "rounded-full bg-success/10 px-3 py-1 text-sm font-semibold text-success"
                : "rounded-full bg-surface-selected px-3 py-1 text-sm font-semibold text-brand"}>
                {STATUS_LABEL[eatery.status]}
              </span>
              {approved && (
                <Link to={`/food/${eatery.slug}`} className="link-arrow text-foreground">View public page <ArrowUpRight aria-hidden /></Link>
              )}
              <button type="button" onClick={() => setAdding(true)} className="link-arrow text-text-secondary"><Plus aria-hidden /> Add another eatery</button>
            </div>
          </div>

          <div className="flex flex-wrap items-stretch gap-3">
            <Button
              variant="outline" className="h-auto rounded-2xl px-4 py-3" aria-pressed={soundOn} onClick={toggleSound}
              title={soundOn ? "A chime plays when a new order arrives" : "New orders arrive silently"}
            >
              {soundOn ? <Bell aria-hidden /> : <BellOff aria-hidden />} Order sound {soundOn ? "on" : "off"}
            </Button>
            <label className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
              <span>
                <span className="block text-sm font-semibold text-foreground">{eatery.accepting_orders ? "Taking orders" : "Not taking orders"}</span>
                <span className="block text-xs text-text-secondary">{approved ? "Switch off when you're closed or too busy" : "Available once approved"}</span>
              </span>
              <Switch checked={eatery.accepting_orders} disabled={!approved} onCheckedChange={toggleOrders} aria-label="Taking orders" />
            </label>
          </div>
        </div>

        {!approved && (
          <p role="status" className="mt-6 rounded-2xl bg-surface-muted p-4 text-sm text-foreground">{STATUS_NOTE[eatery.status as "pending" | "suspended"]}</p>
        )}

        <Tabs value={tab} onValueChange={(value) => setTab(value as EateryTab)} className="mt-8">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="orders">
              Orders
              {waiting > 0 && (
                <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-xs font-bold tabular-nums text-brand-foreground">
                  {waiting}<span className="sr-only"> waiting to be accepted</span>
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="menu">Menu</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-6">
            <EateryOverview eatery={eatery} orders={orders} menuItems={menu?.items} onGo={setTab} />
          </TabsContent>
          <TabsContent value="orders" className="mt-6"><EateryOrders eateryId={eatery.id} prepTimeMin={eatery.prep_time_min} /></TabsContent>
          <TabsContent value="menu" className="mt-6"><EateryMenuManager eateryId={eatery.id} /></TabsContent>
          <TabsContent value="details" className="mt-6 max-w-3xl">
            <EateryDetailsForm
              key={eatery.id}
              eatery={eatery}
              submitLabel="Save changes"
              onSubmit={async (details) => { await updateEatery(eatery.id, details); await refresh(); }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default EateryDashboardPage;
