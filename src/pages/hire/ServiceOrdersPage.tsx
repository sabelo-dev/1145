import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Briefcase } from "lucide-react";
import SEO from "@/components/SEO";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { fetchMyServiceOrders, formatMinor } from "@/services/serviceMarketplace";
import { ORDER_STATE_LABEL, type ServiceOrder } from "@/types/services";

/** A row linking to an order's workspace. Shared with the provider dashboard. */
export const ServiceOrderRow: React.FC<{ order: ServiceOrder; amountMinor: number; counterpart: string }> = ({ order, amountMinor, counterpart }) => (
  <Link to={`/hire/orders/${order.id}`} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-foreground/25">
    <span className="min-w-0">
      <span className="block truncate font-semibold text-foreground">{order.listing_title}</span>
      <span className="block truncate text-sm text-text-secondary">{order.order_number} · {order.package_name} · {counterpart}</span>
      <span className="mt-1 block text-sm tabular-nums text-text-secondary">
        {order.due_at && !["completed", "cancelled", "refunded", "partially_refunded"].includes(order.state)
          ? `Due ${new Date(order.due_at).toLocaleDateString("en-ZA", { dateStyle: "medium" })}`
          : `Placed ${new Date(order.created_at).toLocaleDateString("en-ZA", { dateStyle: "medium" })}`}
      </span>
    </span>
    <span className="shrink-0 text-right">
      <span className="block font-semibold tabular-nums text-foreground">{formatMinor(amountMinor)}</span>
      <span className="block text-sm text-text-secondary">{ORDER_STATE_LABEL[order.state]}</span>
    </span>
  </Link>
);

const ServiceOrdersPage: React.FC = () => {
  const { user } = useAuth();
  const { data: orders, isLoading, isError } = useQuery({
    queryKey: ["my-service-orders", user?.id], queryFn: () => fetchMyServiceOrders(user!.id), enabled: !!user, staleTime: 0,
  });

  return (
    <div className="min-h-screen bg-background">
      <SEO title="My service orders | 1145" noindex />
      <div className="page-container max-w-3xl py-8 md:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="type-headline">My service orders</h1>
          <Link to="/hire/provider" className="link-arrow text-text-secondary">Selling a service? Provider dashboard <ArrowRight aria-hidden /></Link>
        </div>

        {isLoading ? (
          <div className="mt-8 space-y-3" aria-hidden>{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
        ) : isError ? (
          <p role="alert" className="mt-8 text-text-secondary">We couldn't load your orders. Please try again.</p>
        ) : !orders?.length ? (
          <div className="mt-8 rounded-2xl border border-border p-10 text-center">
            <Briefcase className="mx-auto h-10 w-10 text-text-secondary" aria-hidden />
            <p className="type-title mt-4">No service orders yet</p>
            <Link to="/hire" className="link-arrow mt-3 justify-center text-foreground">Browse services <ArrowRight aria-hidden /></Link>
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {orders.map((order) => (
              <li key={order.id}><ServiceOrderRow order={order} amountMinor={order.gross_amount_minor} counterpart={order.provider?.display_name ?? "Provider"} /></li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ServiceOrdersPage;
