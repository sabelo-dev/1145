import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Package, Eye, RotateCcw, X, MapPin, RefreshCw, Truck } from "lucide-react";
import OrderTrackingDialog from "./OrderTrackingDialog";

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
  product?: {
    name: string;
  };
}

interface Order {
  id: string;
  date: string;
  status: string;
  total: number;
  items: number;
  vendor: string;
  trackingNumber: string | null;
  products: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  shipping_address?: any;
  estimated_delivery?: string | null;
  courier_name?: string | null;
  courier_phone?: string | null;
  courier_company?: string | null;
}

const ConsumerOrders: React.FC = () => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchOrders();
      
      // Set up real-time subscription for order updates
      const channel = supabase
        .channel("consumer_orders")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchOrders();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchOrders = async () => {
    if (!user) return;

    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(`
          id,
          status,
          total,
          created_at,
          shipping_address,
          tracking_number,
          estimated_delivery,
          courier_name,
          courier_phone,
          courier_company
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      // Fetch order items for each order
      const ordersWithItems = await Promise.all(
        (ordersData || []).map(async (order) => {
          const { data: itemsData } = await supabase
            .from("order_items")
            .select(`
              id,
              quantity,
              price,
              product_id,
              products (name)
            `)
            .eq("order_id", order.id);

          const products = (itemsData || []).map((item: any) => ({
            name: item.products?.name || "Unknown Product",
            quantity: item.quantity,
            price: Number(item.price),
          }));

          // Get store name from first item
          let vendor = "Unknown Vendor";
          if (itemsData && itemsData.length > 0) {
            const { data: storeData } = await supabase
              .from("order_items")
              .select("stores(name)")
              .eq("order_id", order.id)
              .limit(1)
              .single();
            
            if (storeData && (storeData as any).stores) {
              vendor = (storeData as any).stores.name;
            }
          }

          return {
            id: order.id,
            date: order.created_at,
            status: order.status,
            total: Number(order.total),
            items: products.length,
            vendor,
            trackingNumber: order.tracking_number,
            products,
            shipping_address: order.shipping_address,
            estimated_delivery: order.estimated_delivery,
            courier_name: order.courier_name,
            courier_phone: order.courier_phone,
            courier_company: order.courier_company,
          };
        })
      );

      setOrders(ordersWithItems);
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch orders",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
      pending: { variant: "secondary" },
      processing: { variant: "default", className: "bg-blue-500" },
      shipped: { variant: "outline", className: "border-amber-500 text-amber-600" },
      in_transit: { variant: "default", className: "bg-amber-500" },
      delivered: { variant: "default", className: "bg-green-500" },
      cancelled: { variant: "destructive" },
      returned: { variant: "secondary" },
    };

    const { variant, className } = config[status] || { variant: "secondary" };

    return (
      <Badge variant={variant} className={className}>
        {status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
      </Badge>
    );
  };

  const canCancel = (status: string) => ["pending", "processing"].includes(status);
  const canReturn = (status: string) => status === "delivered";
  const canTrack = (status: string) => ["processing", "shipped", "in_transit", "delivered"].includes(status);

  const handleTrackOrder = (order: Order) => {
    setSelectedOrder(order);
    setTrackingDialogOpen(true);
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to cancel this order?")) return;

    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: "cancelled" })
        .eq("id", orderId);

      if (error) throw error;

      toast({
        title: "Order Cancelled",
        description: "Your order has been cancelled successfully",
      });

      fetchOrders();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to cancel order",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          <span className="text-lg font-medium">Order Management</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {orders.length} total orders
          </span>
          <Button variant="outline" size="sm" onClick={fetchOrders}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="font-semibold mb-2">No Orders Yet</h3>
            <p className="text-sm text-muted-foreground">
              Your orders will appear here once you make a purchase.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      Order #{order.id.slice(0, 8)}
                    </CardTitle>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span>{format(new Date(order.date), "PPP")}</span>
                      <span>•</span>
                      <span>{order.vendor}</span>
                      <span>•</span>
                      <span>{order.items} item(s)</span>
                    </div>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(order.status)}
                    <div className="text-lg font-semibold mt-1">
                      R{order.total.toFixed(2)}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Order Items */}
                  <div className="space-y-2">
                    {order.products.slice(0, 2).map((product, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>
                          {product.name} × {product.quantity}
                        </span>
                        <span>R{product.price.toFixed(2)}</span>
                      </div>
                    ))}
                    {order.products.length > 2 && (
                      <div className="text-sm text-muted-foreground">
                        +{order.products.length - 2} more items
                      </div>
                    )}
                  </div>

                  {/* Tracking Number */}
                  {order.trackingNumber && (
                    <div className="p-3 bg-muted rounded-lg flex items-center gap-3">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">Tracking Number</div>
                        <div className="text-sm text-muted-foreground font-mono">
                          {order.trackingNumber}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2 border-t flex-wrap">
                    {canTrack(order.status) && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleTrackOrder(order)}
                      >
                        <MapPin className="h-4 w-4 mr-1" />
                        Track Order
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTrackOrder(order)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View Details
                    </Button>

                    {canReturn(order.status) && (
                      <Button variant="outline" size="sm">
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Return
                      </Button>
                    )}

                    {canCancel(order.status) && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleCancelOrder(order.id)}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <OrderTrackingDialog
        order={selectedOrder}
        open={trackingDialogOpen}
        onOpenChange={setTrackingDialogOpen}
      />
    </div>
  );
};

export default ConsumerOrders;
