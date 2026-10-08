import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, UtensilsCrossed } from "lucide-react";
import SEO from "@/components/SEO";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { fetchMyFoodOrders } from "@/services/food";
import { formatCurrency } from "@/lib/utils";
import { FOOD_STATUS_LABEL } from "@/types/food";

const FoodOrdersPage: React.FC = () => {
  const { user } = useAuth();
  const { data: orders, isLoading, isError } = useQuery({
    queryKey: ["my-food-orders", user?.id],
    queryFn: () => fetchMyFoodOrders(user!.id),
    enabled: !!user,
    staleTime: 0,
  });

  return (
    <div className="min-h-screen bg-background">
      <SEO title="My food orders | 1145" noindex />
      <div className="page-container max-w-3xl py-8 md:py-12">
        <h1 className="type-headline">My food orders</h1>

        {isLoading ? (
          <div className="mt-8 space-y-3" aria-hidden>{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
        ) : isError ? (
          <p role="alert" className="mt-8 text-text-secondary">We couldn't load your orders. Please try again.</p>
        ) : !orders?.length ? (
          <div className="mt-8 rounded-2xl border border-border p-10 text-center">
            <UtensilsCrossed className="mx-auto h-10 w-10 text-text-secondary" aria-hidden />
            <p className="type-title mt-4">No food orders yet</p>
            <Link to="/food" className="link-arrow mt-3 justify-center text-foreground">Browse eateries <ArrowRight aria-hidden /></Link>
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {orders.map((order) => (
              <li key={order.id}>
                <Link to={`/food/orders/${order.id}`} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-foreground/25">
                  <span className="min-w-0">
                    <span className="block font-semibold text-foreground">{order.eatery?.name ?? "Eatery"}</span>
                    <span className="block truncate text-sm text-text-secondary">
                      {(order.items ?? []).map((i) => `${i.quantity} × ${i.name}`).join(", ")}
                    </span>
                    <span className="mt-1 block text-sm text-text-secondary">
                      {new Date(order.created_at).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold tabular-nums text-foreground">{formatCurrency(order.total)}</span>
                    <span className="block text-sm text-text-secondary">{FOOD_STATUS_LABEL[order.status]}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default FoodOrdersPage;
