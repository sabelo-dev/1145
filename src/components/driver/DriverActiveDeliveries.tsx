import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin,
  Navigation,
  Package,
  CheckCircle,
  Truck,
  Phone,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";

// Helper function to build Google Maps directions URL
const buildGoogleMapsUrl = (address: any, isDirections: boolean = true): string => {
  let addressString = "";
  if (!address) return "";
  if (typeof address === "string") {
    addressString = address;
  } else {
    addressString = [
      address.street,
      address.city,
      address.province,
      address.postal_code,
      address.country || "South Africa"
    ].filter(Boolean).join(", ");
  }
  
  const encoded = encodeURIComponent(addressString);
  if (isDirections) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encoded}`;
};

const openGoogleMaps = (address: any) => {
  const url = buildGoogleMapsUrl(address, true);
  if (url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
};

interface Driver {
  id: string;
  name: string;
  status: string;
}

interface ActiveJob {
  id: string;
  order_id: string;
  pickup_address: any;
  delivery_address: any;
  distance_km: number;
  earnings: number;
  status: string;
  pickup_time: string | null;
  estimated_delivery_time: string | null;
  notes: string | null;
}

interface DriverActiveDeliveriesProps {
  driver: Driver | null;
  onStatusUpdate: () => void;
}

const DriverActiveDeliveries: React.FC<DriverActiveDeliveriesProps> = ({ driver, onStatusUpdate }) => {
  const [jobs, setJobs] = useState<ActiveJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (driver) {
      fetchActiveJobs();
    }
  }, [driver]);

  const fetchActiveJobs = async () => {
    if (!driver) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("delivery_jobs")
      .select("*")
      .eq("driver_id", driver.id)
      .in("status", ["accepted", "picked_up", "in_transit"])
      .order("created_at", { ascending: false });

    if (!error && data) {
      setJobs(data);
    }
    setLoading(false);
  };

  const updateJobStatus = async (jobId: string, newStatus: string) => {
    setUpdating(jobId);

    const updates: any = { status: newStatus };
    
    if (newStatus === "picked_up") {
      updates.pickup_time = new Date().toISOString();
    } else if (newStatus === "delivered") {
      updates.actual_delivery_time = new Date().toISOString();
    }

    const { error } = await supabase
      .from("delivery_jobs")
      .update(updates)
      .eq("id", jobId);

    if (error) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Could not update job status. Please try again.",
      });
    } else {
      const statusMessages: Record<string, string> = {
        picked_up: "Package picked up successfully!",
        in_transit: "Now in transit to delivery location.",
        delivered: "Delivery completed! Great job!",
      };
      
      toast({
        title: "Status Updated",
        description: statusMessages[newStatus] || "Job status updated.",
      });
      
      onStatusUpdate();
      fetchActiveJobs();
    }

    setUpdating(null);
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { color: string; label: string; nextAction: string; nextStatus: string }> = {
      accepted: { color: "bg-blue-500", label: "Accepted", nextAction: "Pick Up", nextStatus: "picked_up" },
      picked_up: { color: "bg-amber-500", label: "Picked Up", nextAction: "Start Delivery", nextStatus: "in_transit" },
      in_transit: { color: "bg-purple-500", label: "In Transit", nextAction: "Complete Delivery", nextStatus: "delivered" },
    };
    return configs[status] || { color: "bg-gray-500", label: status, nextAction: "", nextStatus: "" };
  };

  const formatAddress = (address: any) => {
    if (!address) return "Address not available";
    if (typeof address === "string") return address;
    return `${address.street || ""}, ${address.city || ""}, ${address.province || ""}`.trim();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Active Deliveries</h2>
        <Button variant="outline" onClick={fetchActiveJobs}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No Active Deliveries</h3>
              <p className="text-sm text-muted-foreground">
                Claim available jobs to start delivering.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {jobs.map((job) => {
            const statusConfig = getStatusConfig(job.status);
            
            return (
              <Card key={job.id} className="border-l-4" style={{ borderLeftColor: `var(--${statusConfig.color.replace("bg-", "")})` }}>
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <Badge className={`${statusConfig.color} text-white`}>
                        {statusConfig.label}
                      </Badge>
                      {job.earnings && (
                        <Badge variant="outline" className="text-green-600">
                          R{job.earnings.toFixed(2)}
                        </Badge>
                      )}
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                        <MapPin className="h-5 w-5 text-green-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs font-medium text-green-700">PICKUP</p>
                          <p className="text-sm">{formatAddress(job.pickup_address)}</p>
                          {job.pickup_time && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Picked up at {format(new Date(job.pickup_time), "p")}
                            </p>
                          )}
                          {job.status === "accepted" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2 text-green-600 border-green-300 hover:bg-green-100"
                              onClick={() => openGoogleMaps(job.pickup_address)}
                            >
                              <Navigation className="h-3 w-3 mr-1" />
                              Get Directions
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                        <Navigation className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs font-medium text-blue-700">DELIVER TO</p>
                          <p className="text-sm">{formatAddress(job.delivery_address)}</p>
                          {job.estimated_delivery_time && (
                            <p className="text-xs text-muted-foreground mt-1">
                              ETA: {format(new Date(job.estimated_delivery_time), "p")}
                            </p>
                          )}
                          {(job.status === "picked_up" || job.status === "in_transit") && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2 text-blue-600 border-blue-300 hover:bg-blue-100"
                              onClick={() => openGoogleMaps(job.delivery_address)}
                            >
                              <Navigation className="h-3 w-3 mr-1" />
                              Get Directions
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {job.notes && (
                      <div className="p-3 bg-amber-50 rounded-lg">
                        <p className="text-sm text-amber-800">
                          <strong>Note:</strong> {job.notes}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3">
                      {statusConfig.nextAction && (
                        <Button
                          onClick={() => updateJobStatus(job.id, statusConfig.nextStatus)}
                          disabled={updating === job.id}
                          className="flex-1"
                        >
                          {updating === job.id ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          ) : statusConfig.nextStatus === "delivered" ? (
                            <CheckCircle className="h-4 w-4 mr-2" />
                          ) : (
                            <Package className="h-4 w-4 mr-2" />
                          )}
                          {statusConfig.nextAction}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DriverActiveDeliveries;