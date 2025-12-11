import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { Driver, DeliveryJob } from "@/types/driver";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Package,
  MapPin,
  Clock,
  Phone,
  Navigation,
  CheckCircle,
  Truck,
  XCircle,
  RefreshCw,
} from "lucide-react";

interface DriverActiveDeliveriesProps {
  driver: Driver;
  onStatusUpdate: () => void;
}

const statusSteps = [
  { key: "accepted", label: "Accepted", icon: CheckCircle },
  { key: "picked_up", label: "Picked Up", icon: Package },
  { key: "in_transit", label: "In Transit", icon: Truck },
  { key: "delivered", label: "Delivered", icon: MapPin },
];

const DriverActiveDeliveries: React.FC<DriverActiveDeliveriesProps> = ({
  driver,
  onStatusUpdate,
}) => {
  const [deliveries, setDeliveries] = useState<DeliveryJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchActiveDeliveries();
  }, [driver.id]);

  const fetchActiveDeliveries = async () => {
    try {
      const { data, error } = await supabase
        .from("delivery_jobs")
        .select("*")
        .eq("driver_id", driver.id)
        .in("status", ["accepted", "picked_up", "in_transit"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDeliveries((data as unknown as DeliveryJob[]) || []);
    } catch (error) {
      console.error("Error fetching deliveries:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch active deliveries",
      });
    } finally {
      setLoading(false);
    }
  };

  const getNextStatus = (currentStatus: DeliveryJob["status"]): DeliveryJob["status"] | null => {
    const statusOrder: DeliveryJob["status"][] = ["accepted", "picked_up", "in_transit", "delivered"];
    const currentIndex = statusOrder.indexOf(currentStatus);
    if (currentIndex < statusOrder.length - 1) {
      return statusOrder[currentIndex + 1];
    }
    return null;
  };

  const handleUpdateStatus = async (jobId: string, newStatus: DeliveryJob["status"]) => {
    setUpdating(jobId);

    try {
      const updateData: any = { status: newStatus };
      
      if (newStatus === "delivered") {
        updateData.actual_delivery_time = new Date().toISOString();
      }

      const { error } = await supabase
        .from("delivery_jobs")
        .update(updateData)
        .eq("id", jobId);

      if (error) throw error;

      // If delivered, update driver stats
      if (newStatus === "delivered") {
        const job = deliveries.find((d) => d.id === jobId);
        if (job) {
          // Update driver analytics
          const today = format(new Date(), "yyyy-MM-dd");
          const { data: existingAnalytics } = await supabase
            .from("driver_analytics")
            .select("*")
            .eq("driver_id", driver.id)
            .eq("date", today)
            .maybeSingle();

          if (existingAnalytics) {
            await supabase
              .from("driver_analytics")
              .update({
                deliveries_completed: existingAnalytics.deliveries_completed + 1,
                total_earnings: Number(existingAnalytics.total_earnings) + (job.earnings || 0),
                total_distance_km: Number(existingAnalytics.total_distance_km) + (job.distance_km || 0),
              })
              .eq("id", existingAnalytics.id);
          } else {
            await supabase.from("driver_analytics").insert({
              driver_id: driver.id,
              date: today,
              deliveries_completed: 1,
              total_earnings: job.earnings || 0,
              total_distance_km: job.distance_km || 0,
            });
          }

          // Update driver total deliveries
          await supabase
            .from("drivers")
            .update({ 
              total_deliveries: driver.total_deliveries + 1,
              status: "available"
            })
            .eq("id", driver.id);
        }
      }

      toast({
        title: "Status Updated",
        description: `Delivery marked as ${newStatus.replace("_", " ")}`,
      });

      fetchActiveDeliveries();
      onStatusUpdate();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update status",
      });
    } finally {
      setUpdating(null);
    }
  };

  const handleCancelDelivery = async (jobId: string) => {
    setUpdating(jobId);

    try {
      const { error } = await supabase
        .from("delivery_jobs")
        .update({
          driver_id: null,
          status: "pending",
        })
        .eq("id", jobId);

      if (error) throw error;

      // Set driver back to available
      await supabase
        .from("drivers")
        .update({ status: "available" })
        .eq("id", driver.id);

      toast({
        title: "Delivery Cancelled",
        description: "The job has been released back to the pool",
      });

      fetchActiveDeliveries();
      onStatusUpdate();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to cancel delivery",
      });
    } finally {
      setUpdating(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(amount);
  };

  const getStatusIndex = (status: DeliveryJob["status"]) => {
    return statusSteps.findIndex((s) => s.key === status);
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
      <div>
        <h2 className="text-xl font-semibold">Active Deliveries</h2>
        <p className="text-muted-foreground">
          {deliveries.length} active {deliveries.length === 1 ? "delivery" : "deliveries"}
        </p>
      </div>

      {deliveries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Truck className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="font-semibold mb-2">No Active Deliveries</h3>
            <p className="text-sm text-muted-foreground">
              Accept a job from the available jobs tab to get started
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {deliveries.map((delivery) => (
            <Card key={delivery.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge
                    variant={delivery.status === "in_transit" ? "default" : "outline"}
                    className="capitalize"
                  >
                    {delivery.status.replace("_", " ")}
                  </Badge>
                  {delivery.earnings && (
                    <span className="font-bold text-green-600">
                      {formatCurrency(delivery.earnings)}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Progress Tracker */}
                <div className="relative">
                  <div className="flex justify-between">
                    {statusSteps.map((step, index) => {
                      const isCompleted = getStatusIndex(delivery.status) >= index;
                      const isCurrent = getStatusIndex(delivery.status) === index;
                      const StepIcon = step.icon;

                      return (
                        <div
                          key={step.key}
                          className={`flex flex-col items-center ${
                            index < statusSteps.length - 1 ? "flex-1" : ""
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              isCompleted
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            } ${isCurrent ? "ring-2 ring-primary ring-offset-2" : ""}`}
                          >
                            <StepIcon className="h-4 w-4" />
                          </div>
                          <span
                            className={`text-xs mt-1 ${
                              isCompleted ? "text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="absolute top-4 left-0 right-0 h-0.5 bg-muted -z-10">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{
                        width: `${(getStatusIndex(delivery.status) / (statusSteps.length - 1)) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Route Details */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-green-500" />
                      <span className="text-xs font-medium text-muted-foreground">PICKUP</span>
                    </div>
                    <p className="font-medium">{delivery.pickup_address.street}</p>
                    <p className="text-sm text-muted-foreground">
                      {delivery.pickup_address.city}, {delivery.pickup_address.province}{" "}
                      {delivery.pickup_address.postal_code}
                    </p>
                  </div>

                  <div className="space-y-2 p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-primary" />
                      <span className="text-xs font-medium text-muted-foreground">DELIVERY</span>
                    </div>
                    <p className="font-medium">{delivery.delivery_address.street}</p>
                    <p className="text-sm text-muted-foreground">
                      {delivery.delivery_address.city}, {delivery.delivery_address.province}{" "}
                      {delivery.delivery_address.postal_code}
                    </p>
                  </div>
                </div>

                {/* Notes */}
                {delivery.notes && (
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <p className="text-sm text-yellow-700 dark:text-yellow-400">
                      <span className="font-medium">Note:</span> {delivery.notes}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {getNextStatus(delivery.status) && (
                    <Button
                      className="flex-1"
                      onClick={() =>
                        handleUpdateStatus(delivery.id, getNextStatus(delivery.status)!)
                      }
                      disabled={updating === delivery.id}
                    >
                      {updating === delivery.id ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          Mark as{" "}
                          {getNextStatus(delivery.status)?.replace("_", " ")}
                        </>
                      )}
                    </Button>
                  )}

                  {delivery.status === "accepted" && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="icon">
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancel Delivery?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will release the job back to the available pool. Are you sure?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep Delivery</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleCancelDelivery(delivery.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Cancel Delivery
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default DriverActiveDeliveries;
