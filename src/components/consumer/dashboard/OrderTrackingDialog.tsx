import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  Package,
  Truck,
  MapPin,
  Calendar,
  CheckCircle,
  Clock,
  User,
  Phone,
  Navigation,
  RefreshCw,
} from "lucide-react";

interface OrderProduct {
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  date: string;
  status: string;
  total: number;
  items: number;
  vendor: string;
  trackingNumber: string | null;
  products: OrderProduct[];
  shipping_address?: any;
  estimated_delivery?: string | null;
  courier_name?: string | null;
  courier_phone?: string | null;
  courier_company?: string | null;
}

interface DeliveryJob {
  id: string;
  status: string;
  pickup_time: string | null;
  estimated_delivery_time: string | null;
  actual_delivery_time: string | null;
  driver?: {
    name: string;
    phone: string | null;
    vehicle_type: string | null;
    rating: number | null;
  } | null;
}

interface OrderTrackingDialogProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OrderTrackingDialog: React.FC<OrderTrackingDialogProps> = ({
  order,
  open,
  onOpenChange,
}) => {
  const [deliveryJob, setDeliveryJob] = useState<DeliveryJob | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && order) {
      fetchDeliveryJob();
      
      // Set up real-time subscription
      const channel = supabase
        .channel(`order_tracking_${order.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "delivery_jobs",
            filter: `order_id=eq.${order.id}`,
          },
          (payload) => {
            console.log("Delivery update received:", payload);
            fetchDeliveryJob();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [open, order]);

  const fetchDeliveryJob = async () => {
    if (!order) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("delivery_jobs")
        .select(`
          id,
          status,
          pickup_time,
          estimated_delivery_time,
          actual_delivery_time,
          driver_id
        `)
        .eq("order_id", order.id)
        .maybeSingle();

      if (error) throw error;

      if (data && data.driver_id) {
        // Fetch driver info
        const { data: driverData } = await supabase
          .from("drivers")
          .select("name, phone, vehicle_type, rating")
          .eq("id", data.driver_id)
          .single();

        setDeliveryJob({
          ...data,
          driver: driverData,
        });
      } else {
        setDeliveryJob(data);
      }
    } catch (error) {
      console.error("Error fetching delivery job:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!order) return null;

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
      pending: { variant: "secondary" },
      processing: { variant: "default", className: "bg-blue-500" },
      shipped: { variant: "outline", className: "border-amber-500 text-amber-600" },
      in_transit: { variant: "default", className: "bg-amber-500" },
      out_for_delivery: { variant: "default", className: "bg-purple-500" },
      delivered: { variant: "default", className: "bg-green-500" },
      cancelled: { variant: "destructive" },
    };

    const { variant, className } = config[status] || { variant: "secondary" };

    return (
      <Badge variant={variant} className={className}>
        {status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
      </Badge>
    );
  };

  const getDeliveryStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
      pending: { variant: "secondary" },
      accepted: { variant: "default", className: "bg-blue-500" },
      picked_up: { variant: "default", className: "bg-amber-500" },
      in_transit: { variant: "default", className: "bg-purple-500" },
      delivered: { variant: "default", className: "bg-green-500" },
      cancelled: { variant: "destructive" },
    };

    const { variant, className } = config[status] || { variant: "secondary" };

    return (
      <Badge variant={variant} className={className}>
        {status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
      </Badge>
    );
  };

  // Timeline steps
  const getTimelineSteps = () => {
    const orderStatus = order.status;
    const deliveryStatus = deliveryJob?.status;

    const steps = [
      { id: "ordered", label: "Order Placed", icon: Package, completed: true },
      { id: "processing", label: "Processing", icon: Clock, completed: ["processing", "shipped", "in_transit", "delivered"].includes(orderStatus) },
      { id: "shipped", label: "Shipped", icon: Truck, completed: ["shipped", "in_transit", "delivered"].includes(orderStatus) || !!deliveryJob },
      { id: "in_transit", label: "In Transit", icon: Navigation, completed: deliveryStatus === "in_transit" || deliveryStatus === "picked_up" || orderStatus === "delivered" },
      { id: "delivered", label: "Delivered", icon: CheckCircle, completed: orderStatus === "delivered" || deliveryStatus === "delivered" },
    ];

    return steps;
  };

  const timelineSteps = getTimelineSteps();
  const currentStepIndex = timelineSteps.findIndex((step) => !step.completed);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Track Order - {order.id}</span>
            {getStatusBadge(order.status)}
          </DialogTitle>
          <DialogDescription>Real-time tracking for your order</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Timeline */}
          <Card>
            <CardContent className="pt-6">
              <div className="relative">
                {timelineSteps.map((step, index) => {
                  const Icon = step.icon;
                  const isActive = currentStepIndex === index;
                  const isCompleted = step.completed;
                  const isLast = index === timelineSteps.length - 1;

                  return (
                    <div key={step.id} className="flex items-start mb-6 last:mb-0">
                      <div className="relative flex flex-col items-center mr-4">
                        <div
                          className={`
                            flex items-center justify-center w-10 h-10 rounded-full border-2
                            ${isCompleted ? "bg-green-500 border-green-500 text-white" : 
                              isActive ? "bg-primary border-primary text-primary-foreground animate-pulse" : 
                              "bg-muted border-muted-foreground/30 text-muted-foreground"}
                          `}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        {!isLast && (
                          <div
                            className={`w-0.5 h-12 mt-2 ${
                              isCompleted ? "bg-green-500" : "bg-muted-foreground/30"
                            }`}
                          />
                        )}
                      </div>
                      <div className="flex-1 pt-2">
                        <p
                          className={`font-medium ${
                            isCompleted ? "text-green-600" : isActive ? "text-primary" : "text-muted-foreground"
                          }`}
                        >
                          {step.label}
                        </p>
                        {step.id === "ordered" && (
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(order.date), "PPP 'at' p")}
                          </p>
                        )}
                        {step.id === "delivered" && deliveryJob?.actual_delivery_time && (
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(deliveryJob.actual_delivery_time), "PPP 'at' p")}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Driver Information */}
          {deliveryJob?.driver && (
            <Card className="border-primary/50">
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Driver Information
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{deliveryJob.driver.name}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {deliveryJob.driver.vehicle_type || "Vehicle"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-amber-500">
                        <span>⭐</span>
                        <span className="font-medium">{deliveryJob.driver.rating?.toFixed(1) || "5.0"}</span>
                      </div>
                      {getDeliveryStatusBadge(deliveryJob.status)}
                    </div>
                  </div>

                  {deliveryJob.driver.phone && (
                    <Button variant="outline" className="w-full" asChild>
                      <a href={`tel:${deliveryJob.driver.phone}`}>
                        <Phone className="h-4 w-4 mr-2" />
                        Contact Driver: {deliveryJob.driver.phone}
                      </a>
                    </Button>
                  )}

                  {deliveryJob.estimated_delivery_time && (
                    <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
                      <span className="text-sm font-medium">Estimated Delivery</span>
                      <span className="font-semibold text-green-600">
                        {format(new Date(deliveryJob.estimated_delivery_time), "p")}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Delivery Address */}
          {order.shipping_address && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Delivery Address
                </h3>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{order.shipping_address.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {order.shipping_address.street}
                    <br />
                    {order.shipping_address.city}, {order.shipping_address.province}{" "}
                    {order.shipping_address.postal_code}
                    <br />
                    {order.shipping_address.country}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tracking Number */}
          {order.trackingNumber && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Tracking Information
                </h3>
                <div className="p-3 bg-muted rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Tracking Number</span>
                    <span className="font-mono font-medium">{order.trackingNumber}</span>
                  </div>
                  {order.courier_company && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Courier</span>
                      <span className="font-medium">{order.courier_company}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Order Items */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Items ({order.items})
            </h3>
            <div className="space-y-3">
              {order.products.map((product, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center p-3 bg-muted rounded-lg"
                >
                  <div>
                    <div className="font-medium">{product.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Quantity: {product.quantity}
                    </div>
                  </div>
                  <div className="font-semibold">R{product.price.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Order Total */}
          <div>
            <h3 className="font-semibold mb-3">Order Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>R{(order.total * 0.85).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">VAT (15%)</span>
                <span>R{(order.total * 0.15).toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>R{order.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Refresh Button */}
          <Button
            variant="outline"
            className="w-full"
            onClick={fetchDeliveryJob}
            disabled={loading}
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Tracking
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderTrackingDialog;
