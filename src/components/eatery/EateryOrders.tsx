import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { eaterySetOrderStatus, fetchEateryOrders } from "@/services/food";
import { formatCurrency } from "@/lib/utils";
import type { FoodOrder } from "@/types/food";

/** How each state reads to the eatery (the customer wording differs). */
const KITCHEN_LABEL: Record<FoodOrder["status"], string> = {
  pending_payment: "Awaiting payment",
  placed: "New order",
  preparing: "Preparing",
  ready: "Ready — waiting for driver",
  out_for_delivery: "With the driver",
  delivered: "Delivered",
  rejected: "Declined",
  cancelled: "Cancelled by customer",
};

const ACTIVE: FoodOrder["status"][] = ["placed", "preparing", "ready", "out_for_delivery"];

const minutesSince = (iso: string, now: number) => Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
const ago = (minutes: number) => (minutes < 1 ? "just now" : minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} h ${minutes % 60} min ago`);

const OrderCard: React.FC<{ order: FoodOrder; prepTimeMin: number; now: number; onChanged: () => void }> = ({ order, prepTimeMin, now, onChanged }) => {
  const [busy, setBusy] = useState(false);
  const inKitchen = order.status === "placed" || order.status === "preparing";
  const waited = minutesSince(order.placed_at ?? order.created_at, now);
  // A new order left unanswered for 5 minutes, or one in the kitchen past the eatery's own prep time.
  const late = (order.status === "placed" && waited >= 5) || (order.status === "preparing" && waited > prepTimeMin);

  const move = async (status: "preparing" | "ready" | "rejected", reason?: string) => {
    setBusy(true);
    try {
      await eaterySetOrderStatus(order.id, status, reason);
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update the order. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const decline = () => {
    const reason = window.prompt("Tell the customer why you can't take this order (optional):", "");
    if (reason !== null) void move("rejected", reason);
  };

  return (
    <li className={late ? "rounded-2xl border-2 border-warning bg-card p-4" : order.status === "placed" ? "rounded-2xl border-2 border-brand bg-card p-4" : "rounded-2xl border border-border bg-card p-4"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-foreground">
            #{order.id.slice(-6).toUpperCase()} · {KITCHEN_LABEL[order.status]}
          </p>
          <p className="text-sm text-text-secondary">
            {new Date(order.placed_at ?? order.created_at).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}
            {" · "}{order.delivery_address.name} · <a href={`tel:${order.delivery_address.phone}`} className="underline underline-offset-4">{order.delivery_address.phone}</a>
          </p>
        </div>
        <p className="font-semibold tabular-nums text-foreground">{formatCurrency(order.subtotal)}</p>
      </div>

      {inKitchen && (
        <p className={late ? "mt-2 flex items-center gap-1.5 text-sm font-semibold text-warning" : "mt-2 flex items-center gap-1.5 text-sm text-text-secondary"}>
          <Clock className="h-4 w-4" aria-hidden />
          {order.status === "placed"
            ? `Paid ${ago(waited)}${late ? " — the customer is waiting for you to accept" : ""}`
            : `Ordered ${ago(waited)}${late ? ` — past your ${prepTimeMin} min prep time` : ` · your prep time is ${prepTimeMin} min`}`}
        </p>
      )}

      <ul className="mt-3 space-y-1 text-sm">
        {(order.items ?? []).map((item) => (
          <li key={item.id}><span className="font-semibold tabular-nums">{item.quantity} ×</span> {item.name}</li>
        ))}
      </ul>
      {order.notes && <p className="mt-2 rounded-lg bg-surface-muted p-2 text-sm text-foreground">Note: {order.notes}</p>}
      <p className="mt-2 text-sm text-text-secondary">Deliver to {order.delivery_address.street}, {order.delivery_address.city}</p>
      {order.payment_status === "refund_due" && <p className="mt-2 text-sm font-medium text-warning">Refund due to the customer</p>}

      {(order.status === "placed" || order.status === "preparing") && (
        <div className="mt-4 flex flex-wrap gap-2">
          {order.status === "placed" ? (
            <>
              <Button variant="cta" className="rounded-full" disabled={busy} onClick={() => move("preparing")}>
                {busy && <Loader2 className="animate-spin" aria-hidden />} Accept and start preparing
              </Button>
              <Button variant="outline" className="rounded-full" disabled={busy} onClick={decline}>Decline</Button>
            </>
          ) : (
            <Button variant="cta" className="rounded-full" disabled={busy} onClick={() => move("ready")}>
              {busy && <Loader2 className="animate-spin" aria-hidden />} Mark ready for the driver
            </Button>
          )}
        </div>
      )}
    </li>
  );
};

/** Incoming and past orders for one eatery, updated live. */
const EateryOrders: React.FC<{ eateryId: string; prepTimeMin: number }> = ({ eateryId, prepTimeMin }) => {
  const queryClient = useQueryClient();
  // Re-render every half minute so the waiting times stay current.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const { data: orders, isLoading, isError } = useQuery({
    queryKey: ["eatery-orders", eateryId],
    queryFn: () => fetchEateryOrders(eateryId),
    staleTime: 0,
    // Safety net in case the live connection drops.
    refetchInterval: 60_000,
  });

  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ["eatery-orders", eateryId] }); };

  if (isLoading) return <Skeleton className="h-48 w-full rounded-2xl" />;
  if (isError) return <p role="alert" className="text-text-secondary">We couldn't load your orders. Please refresh the page.</p>;

  // Most urgent first: new orders, then the kitchen queue, each oldest first.
  const active = (orders ?? []).filter((o) => ACTIVE.includes(o.status))
    .sort((a, b) => ACTIVE.indexOf(a.status) - ACTIVE.indexOf(b.status)
      || new Date(a.placed_at ?? a.created_at).getTime() - new Date(b.placed_at ?? b.created_at).getTime());
  const past = (orders ?? []).filter((o) => !ACTIVE.includes(o.status));

  return (
    <div className="space-y-10">
      <section aria-labelledby="active-orders">
        <h3 id="active-orders" className="type-title" aria-live="polite">
          {active.length ? `${active.length} active ${active.length === 1 ? "order" : "orders"}` : "No active orders"}
        </h3>
        {active.length === 0 ? (
          <p className="mt-2 text-text-secondary">New orders appear here as soon as a customer pays. Keep this page open.</p>
        ) : (
          <ul className="mt-4 space-y-3">{active.map((order) => <OrderCard key={order.id} order={order} prepTimeMin={prepTimeMin} now={now} onChanged={refresh} />)}</ul>
        )}
      </section>

      {past.length > 0 && (
        <section aria-labelledby="past-orders">
          <h3 id="past-orders" className="type-title">Past orders</h3>
          <ul className="mt-4 space-y-3">{past.slice(0, 30).map((order) => <OrderCard key={order.id} order={order} prepTimeMin={prepTimeMin} now={now} onChanged={refresh} />)}</ul>
        </section>
      )}
    </div>
  );
};

export default EateryOrders;
