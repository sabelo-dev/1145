import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { eaterySetOrderStatus, fetchEateryOrders, watchEateryOrders } from "@/services/food";
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

const OrderCard: React.FC<{ order: FoodOrder; onChanged: () => void }> = ({ order, onChanged }) => {
  const [busy, setBusy] = useState(false);

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
    <li className="rounded-2xl border border-border bg-card p-4">
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
const EateryOrders: React.FC<{ eateryId: string }> = ({ eateryId }) => {
  const queryClient = useQueryClient();
  const { data: orders, isLoading, isError } = useQuery({
    queryKey: ["eatery-orders", eateryId],
    queryFn: () => fetchEateryOrders(eateryId),
    staleTime: 0,
    // Safety net in case the live connection drops.
    refetchInterval: 60_000,
  });

  useEffect(() => {
    return watchEateryOrders(eateryId, () => { void queryClient.invalidateQueries({ queryKey: ["eatery-orders", eateryId] }); });
  }, [eateryId, queryClient]);

  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ["eatery-orders", eateryId] }); };

  if (isLoading) return <Skeleton className="h-48 w-full rounded-2xl" />;
  if (isError) return <p role="alert" className="text-text-secondary">We couldn't load your orders. Please refresh the page.</p>;

  const active = (orders ?? []).filter((o) => ACTIVE.includes(o.status));
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
          <ul className="mt-4 space-y-3">{active.map((order) => <OrderCard key={order.id} order={order} onChanged={refresh} />)}</ul>
        )}
      </section>

      {past.length > 0 && (
        <section aria-labelledby="past-orders">
          <h3 id="past-orders" className="type-title">Past orders</h3>
          <ul className="mt-4 space-y-3">{past.slice(0, 30).map((order) => <OrderCard key={order.id} order={order} onChanged={refresh} />)}</ul>
        </section>
      )}
    </div>
  );
};

export default EateryOrders;
