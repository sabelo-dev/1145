import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin, DollarSign, Clock, Navigation, Package, RefreshCw, ExternalLink, Route, Loader2,
} from "lucide-react";
import { format } from "date-fns";

const buildGoogleMapsUrl = (address: any): string => {
  if (!address) return "";
  const str = typeof address === "string"
    ? address
    : [address.street, address.city, address.province, address.postal_code, address.country || "South Africa"].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(str)}`;
};

const openGoogleMaps = (address: any) => {
  const url = buildGoogleMapsUrl(address);
  if (url) window.open(url, "_blank", "noopener,noreferrer");
};

interface Driver { id: string; name: string; status: string; }
interface DeliveryJob { id: string; order_id: string; pickup_address: any; delivery_address: any; distance_km: number; earnings: number; created_at: string; notes: string | null; }
interface DriverAvailableJobsProps { driver: Driver | null; onJobClaimed: () => void; }

const DriverAvailableJobs: React.FC<DriverAvailableJobsProps> = ({ driver, onJobClaimed }) => {
  const [jobs, setJobs] = useState<DeliveryJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchAvailableJobs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("delivery_jobs")
      .select("*")
      .eq("status", "pending")
      .is("driver_id", null)
      .order("created_at", { ascending: false });
    if (!error && data) setJobs(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAvailableJobs();
    const channel = supabase
      .channel("available_jobs")
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_jobs", filter: "status=eq.pending" }, () => fetchAvailableJobs())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAvailableJobs]);

  const claimJob = async (jobId: string) => {
    if (!driver) return;
    if (driver.status === "pending") { toast({ variant: "destructive", title: "Cannot Claim Job", description: "Your driver account is still pending approval." }); return; }
    if (driver.status === "offline") { toast({ variant: "destructive", title: "Cannot Claim Job", description: "Please go online to claim jobs." }); return; }

    setClaiming(jobId);
    const { error } = await supabase
      .from("delivery_jobs")
      .update({ driver_id: driver.id, status: "accepted" })
      .eq("id", jobId).eq("status", "pending").is("driver_id", null);

    if (error) {
      toast({ variant: "destructive", title: "Failed to Claim", description: "This job may have been claimed by another driver." });
    } else {
      toast({ title: "Job Claimed!", description: "You have successfully claimed this delivery." });
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-9 w-24" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h2 className="text-xl font-bold">Available Jobs</h2>
          {jobs.length > 0 && (
            <Badge variant="secondary" className="rounded-full font-semibold">{jobs.length}</Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={fetchAvailableJobs} className="rounded-xl">
          <RefreshCw className="h-4 w-4 mr-2" />Refresh
        </Button>
      </div>

      {jobs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center py-16">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-muted mb-4">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-1">No Available Jobs</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">New delivery jobs will appear here. Check back soon!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {jobs.map((job) => (
            <Card key={job.id} className="overflow-hidden border-0 ring-1 ring-border hover:ring-primary/30 hover:shadow-lg transition-all duration-200">
              <CardContent className="p-4 space-y-3">
                {/* Route */}
                <div className="relative space-y-2">
                  <div className="absolute left-[15px] top-[28px] bottom-[28px] w-px border-l-2 border-dashed border-muted-foreground/20" />

                  <div className="flex items-start gap-3">
                    <div className="relative z-10 p-1.5 rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
                      <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Pickup</p>
                      <p className="font-medium text-sm truncate">{formatAddress(job.pickup_address)}</p>
                      <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px] text-emerald-600" onClick={() => openGoogleMaps(job.pickup_address)}>
                        <Navigation className="h-3 w-3 mr-1" />Map<ExternalLink className="h-2.5 w-2.5 ml-1" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="relative z-10 p-1.5 rounded-lg bg-blue-500/10 ring-1 ring-blue-500/20">
                      <Navigation className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Deliver to</p>
                      <p className="font-medium text-sm truncate">{formatAddress(job.delivery_address)}</p>
                      <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px] text-blue-600" onClick={() => openGoogleMaps(job.delivery_address)}>
                        <Navigation className="h-3 w-3 mr-1" />Map<ExternalLink className="h-2.5 w-2.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>

                {job.notes && <p className="text-xs text-muted-foreground italic pl-9">Note: {job.notes}</p>}

                <Separator />

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    {job.distance_km && (
                      <Badge variant="secondary" className="rounded-full text-xs"><Route className="h-3 w-3 mr-1" />{job.distance_km.toFixed(1)} km</Badge>
                    )}
                    {job.earnings && (
                      <Badge className="rounded-full bg-emerald-600 text-xs font-semibold"><DollarSign className="h-3 w-3 mr-0.5" />R{job.earnings.toFixed(2)}</Badge>
                    )}
                    <span className="text-xs text-muted-foreground"><Clock className="h-3 w-3 inline mr-0.5" />{format(new Date(job.created_at), "p")}</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => claimJob(job.id)}
                    disabled={claiming === job.id || driver?.status === "pending" || driver?.status === "offline"}
                    className="rounded-xl h-9 px-4 font-semibold bg-primary hover:bg-primary/90 shadow-sm"
                  >
                    {claiming === job.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Claim Job"}
                  </Button>
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
