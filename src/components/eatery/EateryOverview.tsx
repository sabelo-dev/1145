import React, { useMemo } from "react";
import { Check, ChefHat, Circle, ClipboardList, PackageCheck, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import type { Eatery, FoodOrder, MenuItem } from "@/types/food";

export type EateryTab = "overview" | "orders" | "menu" | "details";

interface EateryOverviewProps {
  eatery: Eatery;
  orders: FoodOrder[] | undefined;
  menuItems: MenuItem[] | undefined;
  onGo: (tab: EateryTab) => void;
}

// Orders that count as a sale: paid for and not declined or cancelled.
const isSale = (order: FoodOrder) => !["pending_payment", "rejected", "cancelled"].includes(order.status);
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const placedAt = (order: FoodOrder) => new Date(order.placed_at ?? order.created_at).getTime();

/** The eatery at a glance: what needs attention now, how today is going, and what's left to set up. */
const EateryOverview: React.FC<EateryOverviewProps> = ({ eatery, orders, menuItems, onGo }) => {
  const stats = useMemo(() => {
    const all = orders ?? [];
    const today = startOfToday();
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const sales = all.filter(isSale);
    const todays = sales.filter((o) => placedAt(o) >= today);
    const week = sales.filter((o) => placedAt(o) >= weekAgo);
    const sum = (list: FoodOrder[]) => list.reduce((total, o) => total + o.subtotal, 0);

    const sold = new Map<string, { quantity: number; revenue: number }>();
    for (const order of sales.filter((o) => placedAt(o) >= monthAgo)) {
      for (const item of order.items ?? []) {
        const entry = sold.get(item.name) ?? { quantity: 0, revenue: 0 };
        entry.quantity += item.quantity;
        entry.revenue += item.unit_price * item.quantity;
        sold.set(item.name, entry);
      }
    }

    return {
      waiting: all.filter((o) => o.status === "placed").length,
      cooking: all.filter((o) => o.status === "preparing").length,
      handover: all.filter((o) => o.status === "ready" || o.status === "out_for_delivery").length,
      todayCount: todays.length,
      todaySales: sum(todays),
      weekCount: week.length,
      weekSales: sum(week),
      average: week.length ? sum(week) / week.length : 0,
      declined: all.filter((o) => o.status === "rejected" && placedAt(o) >= weekAgo).length,
      refundsDue: all.filter((o) => o.payment_status === "refund_due").length,
      top: [...sold.entries()].sort((a, b) => b[1].quantity - a[1].quantity).slice(0, 5),
    };
  }, [orders]);

  if (!orders || !menuItems) return <Skeleton className="h-72 w-full rounded-2xl" />;

  const soldOut = menuItems.filter((i) => !i.is_available);
  const approved = eatery.status === "approved";
  const steps = [
    { done: true, label: "Tell us about your eatery", tab: "details" as EateryTab, action: "Edit details" },
    { done: menuItems.length > 0, label: "Add your menu", tab: "menu" as EateryTab, action: "Add items" },
    { done: approved, label: "Get approved by 1145", hint: approved ? undefined : "We review new eateries before they are listed." },
    { done: eatery.accepting_orders, label: "Switch on orders", hint: approved ? "Use the switch at the top of this page." : "Available once you're approved." },
  ];
  const setupDone = steps.every((s) => s.done);

  const now = [
    { label: "New orders to accept", value: stats.waiting, icon: ClipboardList, urgent: stats.waiting > 0 },
    { label: "Being prepared", value: stats.cooking, icon: ChefHat, urgent: false },
    { label: "Ready or with the driver", value: stats.handover, icon: PackageCheck, urgent: false },
  ];

  return (
    <div className="space-y-10">
      {!setupDone && (
        <section aria-labelledby="setup-title" className="rounded-2xl border border-border bg-card p-5">
          <h2 id="setup-title" className="type-title">Get ready to take orders</h2>
          <ol className="mt-4 space-y-3">
            {steps.map((step) => (
              <li key={step.label} className="flex flex-wrap items-center gap-3">
                <span className={step.done
                  ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground"
                  : "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-border text-text-secondary"}>
                  {step.done ? <Check className="h-4 w-4" aria-hidden /> : <Circle className="h-2.5 w-2.5" aria-hidden />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={step.done ? "text-text-secondary" : "font-medium text-foreground"}>
                    {step.label}<span className="sr-only">{step.done ? " (done)" : " (to do)"}</span>
                  </span>
                  {step.hint && !step.done && <span className="block text-sm text-text-secondary">{step.hint}</span>}
                </span>
                {step.tab && !step.done && <Button variant="outline" size="sm" onClick={() => onGo(step.tab!)}>{step.action}</Button>}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section aria-labelledby="now-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 id="now-title" className="type-title">Right now</h2>
          <Button variant="outline" size="sm" onClick={() => onGo("orders")}>Go to orders</Button>
        </div>
        <dl className="grid gap-3 sm:grid-cols-3">
          {now.map(({ label, value, icon: Icon, urgent }) => (
            <div key={label} className={urgent ? "rounded-2xl border-2 border-brand bg-surface-selected p-5" : "rounded-2xl border border-border bg-card p-5"}>
              <dt className="flex items-center gap-2 text-sm text-text-secondary"><Icon className="h-4 w-4" aria-hidden /> {label}</dt>
              <dd className="mt-1 text-3xl font-semibold tabular-nums text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
        {stats.refundsDue > 0 && (
          <p className="mt-3 text-sm text-warning">{stats.refundsDue} cancelled or declined {stats.refundsDue === 1 ? "order has" : "orders have"} a refund due to the customer. 1145 handles the refund.</p>
        )}
      </section>

      <section aria-labelledby="sales-title">
        <h2 id="sales-title" className="type-title mb-3">Sales</h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Today", value: formatCurrency(stats.todaySales), hint: `${stats.todayCount} ${stats.todayCount === 1 ? "order" : "orders"}` },
            { label: "Last 7 days", value: formatCurrency(stats.weekSales), hint: `${stats.weekCount} ${stats.weekCount === 1 ? "order" : "orders"}` },
            { label: "Average order", value: stats.weekCount ? formatCurrency(stats.average) : "—", hint: "Last 7 days" },
            { label: "Declined", value: String(stats.declined), hint: "Last 7 days" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-border bg-card p-5">
              <dt className="text-sm text-text-secondary">{stat.label}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{stat.value}</dd>
              <p className="mt-1 text-xs tabular-nums text-text-secondary">{stat.hint}</p>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-text-secondary">
          Food sales only: the value of items on paid orders, excluding the delivery fee and before any 1145 fees. Based on your most recent 100 orders.
        </p>
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="top-title">
          <h2 id="top-title" className="type-title mb-3 flex items-center gap-2"><TrendingUp className="h-5 w-5" aria-hidden /> Best sellers, last 30 days</h2>
          {stats.top.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-text-secondary">Your best-selling items will show here once orders come in.</p>
          ) : (
            <ol className="divide-y divide-border rounded-2xl border border-border">
              {stats.top.map(([name, item], index) => (
                <li key={name} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <span className="min-w-0"><span className="mr-2 tabular-nums text-text-secondary">{index + 1}.</span><span className="font-medium text-foreground">{name}</span></span>
                  <span className="shrink-0 tabular-nums text-text-secondary">{item.quantity} sold · {formatCurrency(item.revenue)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section aria-labelledby="menu-health-title">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <h2 id="menu-health-title" className="type-title">Menu</h2>
            <Button variant="outline" size="sm" onClick={() => onGo("menu")}>Manage menu</Button>
          </div>
          <div className="rounded-2xl border border-border p-5 text-sm">
            <p className="text-foreground"><span className="text-2xl font-semibold tabular-nums">{menuItems.length - soldOut.length}</span> of {menuItems.length} items available to order</p>
            {soldOut.length > 0 ? (
              <>
                <p className="mt-3 font-medium text-foreground">Marked sold out</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-text-secondary">
                  {soldOut.slice(0, 6).map((item) => <li key={item.id}>{item.name}</li>)}
                  {soldOut.length > 6 && <li>and {soldOut.length - 6} more</li>}
                </ul>
              </>
            ) : menuItems.length > 0 ? (
              <p className="mt-2 text-text-secondary">Nothing is marked sold out.</p>
            ) : (
              <p className="mt-2 text-text-secondary">Your menu is empty. Customers can't order until you add items.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default EateryOverview;
