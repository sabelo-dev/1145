import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Loader2, Phone } from "lucide-react";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { cancelFoodOrder, fetchFoodOrder, payForFoodOrder, watchFoodOrder } from "@/services/food";
import { cn, formatCurrency } from "@/lib/utils";
import { FOOD_PROGRESS, FOOD_STATUS_LABEL } from "@/types/food";

const FoodOrderPage: React.FC = () => {
  const { orderId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const justPaid = searchParams.get("paid") === "1";
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<"pay" | "cancel" | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const queryKey = ["food-order", orderId];
  const { data: order, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchFoodOrder(orderId),
    staleTime: 0,
    // Back from PayFast: the confirmation arrives separately, so check until it lands.
    refetchInterval: (query) => (justPaid && query.state.data?.status === "pending_payment" ? 3000 : false),
  });

  // Live status while the order is in progress.
  useEffect(() => {
    if (!orderId) return;
    return watchFoodOrder(orderId, () => { void queryClient.invalidateQueries({ queryKey: ["food-order", orderId] }); });
  }, [orderId, queryClient]);

  if (isLoading) {
    return <div className="page-container py-10" aria-busy><Skeleton className="h-10 w-72" /><Skeleton className="mt-6 h-64 w-full rounded-2xl" /></div>;
  }
  if (!order) {
    return (
      <div className="page-container py-20 text-center">
        <h1 className="type-title">We couldn't find that order</h1>
        <Link to="/food/orders" className="link-arrow mt-4 justify-center text-foreground"><ArrowLeft aria-hidden /> My food orders</Link>
      </div>
    );
  }

  const step = FOOD_PROGRESS.indexOf(order.status);
  const stopped = order.status === "cancelled" || order.status === "rejected";
  const awaitingPayment = order.status === "pending_payment";
  const canCancel = awaitingPayment || order.status === "placed";

  const run = async (kind: "pay" | "cancel", action: () => Promise<void>) => {
    setFailure(null);
    setBusy(kind);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey });
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const headline = awaitingPayment
    ? (justPaid ? "Confirming your payment…" : "This order hasn't been paid for yet")
    : order.status === "placed" ? `Waiting for ${order.eatery?.name ?? "the eatery"} to accept`
      : FOOD_STATUS_LABEL[order.status];

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Your food order | 1145" noindex />
      <div className="page-container max-w-3xl py-6 md:py-10">
        <Link to="/food/orders" className="link-arrow min-h-[44px] text-text-secondary"><ArrowLeft aria-hidden /> My food orders</Link>

        <p className="eyebrow mt-4 text-text-secondary">Order #{order.id.slice(-6).toUpperCase()} · {order.eatery?.name}</p>
        <h1 className="type-headline mt-2" aria-live="polite">{headline}</h1>

        {awaitingPayment && justPaid && (
          <p className="mt-3 flex items-center gap-2 text-text-secondary" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> This usually takes a few seconds. You can stay on this page.
          </p>
        )}
        {order.status === "rejected" && (
          <p className="mt-3 text-text-secondary">
            {order.reject_reason ? `The eatery said: “${order.reject_reason}”. ` : ""}
            {order.payment_status === "refund_due" ? "Your payment will be refunded." : ""}
          </p>
        )}
        {order.status === "cancelled" && order.payment_status === "refund_due" && (
          <p className="mt-3 text-text-secondary">Your payment will be refunded.</p>
        )}
        {order.payment_status === "refunded" && <p className="mt-3 text-text-secondary">Your payment has been refunded.</p>}

        {/* Progress */}
        {!stopped && !awaitingPayment && (
          <ol className="mt-8 space-y-0" aria-label="Order progress">
            {FOOD_PROGRESS.map((status, i) => {
              const done = i < step || order.status === "delivered";
              const current = i === step && order.status !== "delivered";
              return (
                <li key={status} className="flex gap-4" aria-current={current ? "step" : undefined}>
                  <div className="flex flex-col items-center">
                    <span className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold",
                      done ? "border-brand bg-brand text-brand-foreground"
                        : current ? "border-brand text-brand" : "border-border text-text-secondary",
                    )}>
                      {done ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
                    </span>
                    {i < FOOD_PROGRESS.length - 1 && <span aria-hidden className={cn("my-1 w-0.5 flex-1 min-h-[1.25rem]", done ? "bg-brand" : "bg-border")} />}
                  </div>
                  <p className={cn("pb-5 pt-1", current ? "font-semibold text-foreground" : done ? "text-foreground" : "text-text-secondary")}>
                    {FOOD_STATUS_LABEL[status]}
                    {done && <span className="sr-only"> (done)</span>}
                  </p>
                </li>
              );
            })}
          </ol>
        )}

        {failure && <p role="alert" className="mt-6 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{failure}</p>}

        {(awaitingPayment || canCancel) && (
          <div className="mt-6 flex flex-wrap gap-3">
            {awaitingPayment && !justPaid && (
              <Button
                variant="cta" size="lg" className="rounded-full" disabled={!!busy}
                onClick={() => run("pay", () => payForFoodOrder(order.id, { email: user?.email, firstName: order.delivery_address.name }))}
              >
                {busy === "pay" ? <Loader2 className="animate-spin" aria-hidden /> : null} Pay {formatCurrency(order.total)}
              </Button>
            )}
            <Button variant="outline" size="lg" className="rounded-full" disabled={!!busy} onClick={() => run("cancel", () => cancelFoodOrder(order.id))}>
              {busy === "cancel" ? <Loader2 className="animate-spin" aria-hidden /> : null} Cancel order
            </Button>
          </div>
        )}

        {/* Summary */}
        <section className="mt-10 rounded-2xl border border-border bg-card p-5" aria-labelledby="order-summary">
          <h2 id="order-summary" className="type-title">Order summary</h2>
          <ul className="mt-4 space-y-3">
            {(order.items ?? []).map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0"><span className="tabular-nums">{item.quantity} ×</span> {item.name}</span>
                <span className="shrink-0 font-medium tabular-nums">{formatCurrency(item.unit_price * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm tabular-nums">
            <div className="flex justify-between"><dt className="text-text-secondary">Subtotal</dt><dd>{formatCurrency(order.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-text-secondary">Delivery</dt><dd>{order.delivery_fee > 0 ? formatCurrency(order.delivery_fee) : "Free"}</dd></div>
            <div className="flex justify-between pt-1 text-base font-semibold"><dt>Total</dt><dd>{formatCurrency(order.total)}</dd></div>
          </dl>
          <div className="mt-4 border-t border-border pt-4 text-sm">
            <p className="font-semibold text-foreground">Delivering to</p>
            <p className="mt-1 text-text-secondary">
              {order.delivery_address.name}<br />
              {order.delivery_address.street}, {order.delivery_address.city} {order.delivery_address.postal_code}<br />
              {order.delivery_address.phone}
            </p>
            {order.notes && <p className="mt-2 text-text-secondary">Note: {order.notes}</p>}
          </div>
          {order.eatery?.phone && (
            <a href={`tel:${order.eatery.phone}`} className="link-arrow mt-4 min-h-[44px] text-foreground">
              <Phone aria-hidden /> Call {order.eatery.name}
            </a>
          )}
        </section>
      </div>
    </div>
  );
};

export default FoodOrderPage;
