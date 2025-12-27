import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  MapPin,
  Navigation,
  Clock,
  Phone,
  MessageCircle,
  Star,
  Truck,
  Package,
  CheckCircle,
  Store,
  Home,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DeliveryStatus {
  id: string;
  status: string;
  driver: {
    id: string;
    name: string;
    phone: string | null;
    rating: number | null;
    vehicle_type: string | null;
    avatar_url?: string;
    current_location?: {
      lat: number;
      lng: number;
    };
  } | null;
  pickup_address: any;
  delivery_address: any;
  pickup_time: string | null;
  estimated_delivery_time: string | null;
  created_at: string;
}

interface CustomerDeliveryTrackingProps {
  orderId: string;
  deliveryOtp?: string;
}

const CustomerDeliveryTracking: React.FC<CustomerDeliveryTrackingProps> = ({
  orderId,
  deliveryOtp = "1234",
}) => {
  const [delivery, setDelivery] = useState<DeliveryStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [eta, setEta] = useState<number | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [message, setMessage] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchDeliveryStatus();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel(`delivery-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_jobs",
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          if (payload.new) {
            updateDeliveryFromPayload(payload.new);
          }
        }
      )
      .subscribe();

    // ETA countdown timer
    const etaInterval = setInterval(() => {
      if (delivery?.estimated_delivery_time) {
        const remaining = new Date(delivery.estimated_delivery_time).getTime() - Date.now();
        setEta(Math.max(0, Math.floor(remaining / 60000)));
      }
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(etaInterval);
    };
  }, [orderId]);

  const fetchDeliveryStatus = async () => {
    setLoading(true);

    const { data: job, error } = await supabase
      .from("delivery_jobs")
      .select(`
        *,
        drivers (
          id,
          name,
          phone,
          rating,
          vehicle_type,
          current_location
        )
      `)
      .eq("order_id", orderId)
      .single();

    if (!error && job) {
      const driverData = job.drivers as any;
      const rawLoc = driverData?.current_location as { lat?: number; lng?: number } | null;
      
      setDelivery({
        ...job,
        driver: driverData ? {
          ...driverData,
          current_location: rawLoc?.lat && rawLoc?.lng ? { lat: rawLoc.lat, lng: rawLoc.lng } : undefined,
        } : null,
      });

      if (job.estimated_delivery_time) {
        const remaining = new Date(job.estimated_delivery_time).getTime() - Date.now();
        setEta(Math.max(0, Math.floor(remaining / 60000)));
      }
    }

    setLoading(false);
  };

  const updateDeliveryFromPayload = async (payload: any) => {
    // Refetch to get driver details
    await fetchDeliveryStatus();
  };

  const handleMaskedCall = () => {
    // In real app, this would initiate a masked/proxy call
    toast({
      title: "Calling Driver",
      description: "Connecting you with your driver...",
    });
  };

  const handleSendMessage = () => {
    if (!message.trim()) return;
    
    toast({
      title: "Message Sent",
      description: "Your driver will receive your message shortly.",
    });
    setMessage("");
    setShowChat(false);
  };

  const getStatusSteps = () => {
    const steps = [
      { key: "pending", label: "Order Placed", icon: Package },
      { key: "accepted", label: "Driver Assigned", icon: Truck },
      { key: "picked_up", label: "Picked Up", icon: Store },
      { key: "in_transit", label: "On The Way", icon: Navigation },
      { key: "delivered", label: "Delivered", icon: CheckCircle },
    ];

    const currentIndex = steps.findIndex((s) => s.key === delivery?.status);
    
    return steps.map((step, index) => ({
      ...step,
      completed: index <= currentIndex,
      active: index === currentIndex,
    }));
  };

  const formatAddress = (address: any) => {
    if (!address) return "Address not available";
    if (typeof address === "string") return address;
    return `${address.street || ""}, ${address.city || ""}`.trim();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-48">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!delivery) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Delivery Not Found</h3>
            <p className="text-sm text-muted-foreground">
              We couldn't find tracking information for this order.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const steps = getStatusSteps();
  const progressPercent = ((steps.findIndex((s) => s.active) + 1) / steps.length) * 100;

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Delivery Status</CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchDeliveryStatus}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Steps */}
          <div className="relative">
            <Progress value={progressPercent} className="h-2 mb-4" />
            <div className="flex justify-between">
              {steps.map((step, index) => (
                <div
                  key={step.key}
                  className={`flex flex-col items-center ${
                    step.completed ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <div
                    className={`p-2 rounded-full ${
                      step.active
                        ? "bg-primary text-primary-foreground"
                        : step.completed
                        ? "bg-primary/20"
                        : "bg-muted"
                    }`}
                  >
                    <step.icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs mt-1 hidden sm:block">{step.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ETA */}
          {delivery.status !== "delivered" && eta !== null && (
            <div className="bg-primary/5 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{eta}</span>
                <span className="text-muted-foreground">min</span>
              </div>
              <p className="text-sm text-muted-foreground">Estimated arrival</p>
            </div>
          )}

          {/* Delivery OTP */}
          {delivery.status === "in_transit" && (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 text-center">
              <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                Your delivery OTP
              </p>
              <div className="text-3xl font-mono font-bold tracking-widest text-amber-600">
                {deliveryOtp}
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                Share this with your driver to confirm delivery
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Driver Card */}
      {delivery.driver && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={delivery.driver.avatar_url} />
                <AvatarFallback className="text-lg">
                  {delivery.driver.name?.charAt(0)?.toUpperCase() || "D"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="font-semibold">{delivery.driver.name}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span>{delivery.driver.rating?.toFixed(1) || "5.0"}</span>
                  <span>•</span>
                  <span className="capitalize">{delivery.driver.vehicle_type || "Car"}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={handleMaskedCall}>
                  <Phone className="h-4 w-4" />
                </Button>
                <Dialog open={showChat} onOpenChange={setShowChat}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon">
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Message Driver</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Textarea
                        placeholder="Type your message to the driver..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={4}
                      />
                      <Button className="w-full" onClick={handleSendMessage}>
                        Send Message
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Map Placeholder */}
      {delivery.status !== "pending" && delivery.status !== "delivered" && (
        <Card>
          <CardContent className="pt-6">
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
              {/* This would be replaced with actual map integration */}
              <div className="text-center space-y-2">
                <Navigation className="h-12 w-12 mx-auto text-primary animate-pulse" />
                <p className="text-sm text-muted-foreground">
                  Live tracking map
                </p>
                {delivery.driver?.current_location && (
                  <p className="text-xs text-muted-foreground">
                    Driver location updating...
                  </p>
                )}
              </div>
              
              {/* Animated driver icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                  <Truck className="h-8 w-8 text-primary relative z-10" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Addresses */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <Store className="h-4 w-4 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground">Pickup</p>
              <p className="font-medium">{formatAddress(delivery.pickup_address)}</p>
              {delivery.pickup_time && (
                <p className="text-xs text-green-600 mt-1">
                  Picked up at {new Date(delivery.pickup_time).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>

          <div className="border-l-2 border-dashed ml-4 h-4" />

          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Home className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground">Delivery</p>
              <p className="font-medium">{formatAddress(delivery.delivery_address)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivered Success */}
      {delivery.status === "delivered" && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-900/20">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
            <h3 className="font-semibold text-green-800 dark:text-green-200">
              Delivery Complete!
            </h3>
            <p className="text-sm text-green-700 dark:text-green-300">
              Your order has been delivered successfully.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CustomerDeliveryTracking;
