import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin,
  DollarSign,
  Clock,
  Navigation,
  Package,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";

// Helper function to build Google Maps directions URL
const buildGoogleMapsUrl = (address: any): string => {
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
  return `https://www.google.com/maps/search/?api=1&query=${encoded}`;
};

const openGoogleMaps = (address: any) => {
  const url = buildGoogleMapsUrl(address);
  if (url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
};

interface Driver {
  id: string;
  name: string;
  status: string;
}

interface DeliveryJob {
  id: string;
  order_id: string;
  pickup_address: any;
  delivery_address: any;
  distance_km: number;
  earnings: number;
  created_at: string;
  notes: string | null;
}

interface DriverAvailableJobsProps {
  driver: Driver | null;
  onJobClaimed: () => void;
}

const DriverAvailableJobs: React.FC<DriverAvailableJobsProps> = ({ driver, onJobClaimed }) => {
  const [jobs, setJobs] = useState<DeliveryJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchAvailableJobs();
    
    // Set up real-time subscription
    const channel = supabase
      .channel("available_jobs")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_jobs",
          filter: "status=eq.pending",
        },
        () => {
          fetchAvailableJobs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAvailableJobs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("delivery_jobs")
      .select("*")
      .eq("status", "pending")
      .is("driver_id", null)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setJobs(data);
    }
    setLoading(false);
  };

  const claimJob = async (jobId: string) => {
    if (!driver) return;

    if (driver.status === "pending") {
      toast({
        variant: "destructive",
        title: "Cannot Claim Job",
        description: "Your driver account is still pending approval.",
      });
      return;
    }

    if (driver.status === "offline") {
      toast({
        variant: "destructive",
        title: "Cannot Claim Job",
        description: "Please go online to claim jobs.",
      });
      return;
    }

    setClaiming(jobId);

    const { error } = await supabase
      .from("delivery_jobs")
      .update({
        driver_id: driver.id,
        status: "accepted",
      })
      .eq("id", jobId)
      .eq("status", "pending")
      .is("driver_id", null);

    if (error) {
      toast({
        variant: "destructive",
        title: "Failed to Claim",
        description: "This job may have been claimed by another driver.",
      });
    } else {
      toast({
        title: "Job Claimed!",
        description: "You have successfully claimed this delivery.",
      });
      onJobClaimed();
      fetchAvailableJobs();
    }

    setClaiming(null);
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
        <h2 className="text-xl font-semibold">Available Delivery Jobs</h2>
        <Button variant="outline" onClick={fetchAvailableJobs}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No Available Jobs</h3>
              <p className="text-sm text-muted-foreground">
                New delivery jobs will appear here. Check back soon!
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {jobs.map((job) => (
            <Card key={job.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <MapPin className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Pickup</p>
                        <p className="font-medium">{formatAddress(job.pickup_address)}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1 h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => openGoogleMaps(job.pickup_address)}
                        >
                          <Navigation className="h-3 w-3 mr-1" />
                          View on Map
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Navigation className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Deliver to</p>
                        <p className="font-medium">{formatAddress(job.delivery_address)}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1 h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => openGoogleMaps(job.delivery_address)}
                        >
                          <Navigation className="h-3 w-3 mr-1" />
                          View on Map
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </div>

                    {job.notes && (
                      <p className="text-sm text-muted-foreground italic">
                        Note: {job.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <div className="flex items-center gap-4">
                      {job.distance_km && (
                        <Badge variant="outline">
                          {job.distance_km.toFixed(1)} km
                        </Badge>
                      )}
                      {job.earnings && (
                        <Badge className="bg-green-500">
                          <DollarSign className="h-3 w-3 mr-1" />
                          R{job.earnings.toFixed(2)}
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 inline mr-1" />
                      Posted {format(new Date(job.created_at), "p")}
                    </p>

                    <Button
                      onClick={() => claimJob(job.id)}
                      disabled={claiming === job.id || driver?.status === "pending" || driver?.status === "offline"}
                    >
                      {claiming === job.id ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Claiming...
                        </>
                      ) : (
                        "Claim Job"
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default DriverAvailableJobs;