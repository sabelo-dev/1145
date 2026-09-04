import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ShipmentTracking from "@/components/orders/ShipmentTracking";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";

const OrderTrackingPage = React.forwardRef<HTMLDivElement>((_props, ref) => {
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const [order, setOrder] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, status, payment_status, total, created_at, tracking_number, courier_company, shipping_address")
        .eq("id", orderId)
        .maybeSingle();
      const { data: it } = await supabase
        .from("order_items")
        .select("id, quantity, price, products(name)")
        .eq("order_id", orderId);
      if (!active) return;
      setOrder(data);
      setItems(it || []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [orderId, user?.id]);

  return (
    <div ref={ref} className="container mx-auto px-4 py-6 pb-nav max-w-3xl space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/consumer/dashboard"><ArrowLeft className="h-4 w-4 mr-2" />My orders</Link>
      </Button>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : !order ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">
          We could not find this order. Please sign in with the account that placed it.
        </CardContent></Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base header-row">
                <span className="truncate">Order {order.order_number || order.id.slice(0, 8).toUpperCase()}</span>
                <Badge variant="outline">{String(order.status).replace(/_/g, " ")}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Placed {order.created_at ? format(new Date(order.created_at), "d MMM yyyy") : ""}
              </p>
              {items.map((i) => (
                <div key={i.id} className="flex justify-between gap-3">
                  <span className="truncate">{i.quantity} × {i.products?.name || "Item"}</span>
                  <span className="shrink-0">R{Number(i.price || 0).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between font-semibold pt-2 border-t">
                <span>Total</span><span>R{Number(order.total || 0).toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          <ShipmentTracking orderId={order.id} />
        </>
      )}
    </div>
  );
});

OrderTrackingPage.displayName = "OrderTrackingPage";
export default OrderTrackingPage;
