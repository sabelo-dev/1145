import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Truck, MapPin, Navigation, Clock, Check, RefreshCw, Package,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

interface RequestDeliveryButtonProps {
  orderId: string;
  shippingAddress: any;
  storeName?: string;
  onDeliveryRequested?: () => void;
}

export const RequestDeliveryButton: React.FC<RequestDeliveryButtonProps> = ({
  orderId,
  shippingAddress,
  storeName,
  onDeliveryRequested,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [existingJob, setExistingJob] = useState<any>(null);

  useEffect(() => {
    checkExistingJob();
  }, [orderId]);

  const checkExistingJob = async () => {
    const { data } = await supabase
      .from("delivery_jobs")
      .select("id, status, driver_id")
      .eq("order_id", orderId)
      .maybeSingle();
    setExistingJob(data);
  };

  const requestDelivery = async () => {
    setLoading(true);
    try {
      const pickupAddress = {
        street: storeName || "Store Pickup",
        city: "Johannesburg",
        province: "Gauteng",
        country: "South Africa",
      };

      const deliveryAddress = typeof shippingAddress === "string"
        ? { street: shippingAddress }
        : shippingAddress || { street: "Customer address" };

      const { error } = await supabase.from("delivery_jobs").insert({
        order_id: orderId,
        pickup_address: pickupAddress,
        delivery_address: deliveryAddress,
        status: "pending",
      });

      if (error) throw error;

      toast({ title: "Delivery Requested", description: "A driver will be matched shortly." });
      checkExistingJob();
      onDeliveryRequested?.();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (existingJob) {
    return (
      <Badge variant="outline" className="gap-1">
        <Truck className="h-3 w-3" />
        Delivery: {existingJob.status}
      </Badge>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={requestDelivery} disabled={loading}>
      <Truck className="h-4 w-4 mr-2" />
      {loading ? "Requesting..." : "Request Delivery"}
    </Button>
  );
};

// Order Delivery Tracker for customer-facing views
interface OrderDeliveryTrackerProps {
  orderId: string;
}

export const OrderDeliveryTracker: React.FC<OrderDeliveryTrackerProps> = ({ orderId }) => {
  const [job, setJob] = useState<any>(null);

  useEffect(() => {
    fetchJob();

    const channel = supabase
      .channel(`delivery-order-${orderId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "delivery_jobs",
        filter: `order_id=eq.${orderId}`,
      }, () => fetchJob())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orderId]);

  const fetchJob = async () => {
    const { data } = await supabase
      .from("delivery_jobs")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();
    setJob(data);
  };

  if (!job) return null;

  const statusSteps = [
    { key: "pending", label: "Pending" },
    { key: "assigned", label: "Driver Assigned" },
    { key: "picked_up", label: "Picked Up" },
    { key: "in_transit", label: "In Transit" },
    { key: "delivered", label: "Delivered" },
  ];

  const currentIdx = statusSteps.findIndex(s => s.key === job.status);

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Truck className="h-4 w-4" />Delivery Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-1">
          {statusSteps.map((step, i) => (
            <React.Fragment key={step.key}>
              <div className={`flex flex-col items-center ${i <= currentIdx ? "text-primary" : "text-muted-foreground"}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  i < currentIdx ? "bg-primary text-primary-foreground" :
                  i === currentIdx ? "bg-primary/20 border-2 border-primary text-primary" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {i < currentIdx ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                <span className="text-[10px] mt-1 text-center leading-tight w-14">{step.label}</span>
              </div>
              {i < statusSteps.length - 1 && (
                <div className={`flex-1 h-0.5 mt-[-14px] ${i < currentIdx ? "bg-primary" : "bg-muted"}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default RequestDeliveryButton;
