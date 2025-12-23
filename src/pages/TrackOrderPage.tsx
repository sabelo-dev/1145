import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SEO from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Package,
  Truck,
  MapPin,
  CheckCircle,
  Clock,
  Navigation,
  Search,
  AlertCircle,
} from "lucide-react";

interface OrderData {
  id: string;
  status: string;
  total: number;
  created_at: string;
  tracking_number: string | null;
  courier_company: string | null;
  courier_name: string | null;
  estimated_delivery: string | null;
  shipping_address: any;
}

const TrackOrderPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialTracking = searchParams.get("tracking") || "";
  const [trackingNumber, setTrackingNumber] = useState(initialTracking);
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!trackingNumber.trim()) {
      toast({
        title: "Error",
        description: "Please enter a tracking number",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, total, created_at, tracking_number, courier_company, courier_name, estimated_delivery, shipping_address")
        .eq("tracking_number", trackingNumber.trim())
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setOrder(data);
      } else {
        setOrder(null);
        toast({
          title: "Not Found",
          description: "No order found with this tracking number",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Error fetching order:", error);
      toast({
        title: "Error",
        description: "Failed to fetch order details",
        variant: "destructive",
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

  const getTimelineSteps = (orderStatus: string) => {
    const steps = [
      { id: "ordered", label: "Order Placed", icon: Package, completed: true },
      { id: "processing", label: "Processing", icon: Clock, completed: ["processing", "shipped", "in_transit", "out_for_delivery", "delivered"].includes(orderStatus) },
      { id: "shipped", label: "Shipped", icon: Truck, completed: ["shipped", "in_transit", "out_for_delivery", "delivered"].includes(orderStatus) },
      { id: "in_transit", label: "In Transit", icon: Navigation, completed: ["in_transit", "out_for_delivery", "delivered"].includes(orderStatus) },
      { id: "delivered", label: "Delivered", icon: CheckCircle, completed: orderStatus === "delivered" },
    ];

    return steps;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <SEO
        title="Track Your Order"
        description="Track your order status using your tracking number"
      />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Track Your Order</h1>
            <p className="text-muted-foreground">
              Enter your tracking number to see the current status of your order
            </p>
          </div>

          {/* Search Form */}
          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Input
                  placeholder="Enter your tracking number"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="flex-1"
                />
                <Button onClick={handleSearch} disabled={loading}>
                  <Search className="h-4 w-4 mr-2" />
                  {loading ? "Searching..." : "Track"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Order Details */}
          {order && (
            <div className="space-y-6">
              {/* Status Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Order #{order.id.slice(0, 8)}</CardTitle>
                      <CardDescription>
                        Placed on {format(new Date(order.created_at), "PPP")}
                      </CardDescription>
                    </div>
                    {getStatusBadge(order.status)}
                  </div>
                </CardHeader>
              </Card>

              {/* Order Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Order Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    {getTimelineSteps(order.status).map((step, index) => {
                      const Icon = step.icon;
                      const steps = getTimelineSteps(order.status);
                      const currentStepIndex = steps.findIndex((s) => !s.completed);
                      const isActive = currentStepIndex === index;
                      const isCompleted = step.completed;
                      const isLast = index === steps.length - 1;

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
                                {format(new Date(order.created_at), "PPP 'at' p")}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Shipping Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    Shipping Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Tracking Number</p>
                      <p className="font-mono font-medium">{order.tracking_number}</p>
                    </div>
                    {order.courier_company && (
                      <div>
                        <p className="text-sm text-muted-foreground">Courier</p>
                        <p className="font-medium">{order.courier_company}</p>
                      </div>
                    )}
                    {order.estimated_delivery && (
                      <div>
                        <p className="text-sm text-muted-foreground">Estimated Delivery</p>
                        <p className="font-medium">{format(new Date(order.estimated_delivery), "PPP")}</p>
                      </div>
                    )}
                  </div>

                  {order.shipping_address && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Delivery Address
                        </p>
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
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Order Total */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Order Total</span>
                    <span className="text-2xl font-bold">R{order.total.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* No Order Found */}
          {searched && !order && !loading && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Order Not Found</h3>
                  <p className="text-muted-foreground">
                    We couldn't find an order with tracking number "{trackingNumber}".
                    <br />
                    Please check the number and try again.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TrackOrderPage;
