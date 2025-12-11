import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Driver, DeliveryJob } from "@/types/driver";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Package,
  MapPin,
  Clock,
  DollarSign,
  ArrowRight,
  RefreshCw,
  Navigation,
} from "lucide-react";

interface DriverAvailableJobsProps {
  driver: Driver;
  onJobAccepted: () => void;
}

const DriverAvailableJobs: React.FC<DriverAvailableJobsProps> = ({
  driver,
  onJobAccepted,
}) => {
  const [jobs, setJobs] = useState<DeliveryJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchAvailableJobs();

    // Set up real-time subscription for new jobs
    const channel = supabase
      .channel("available_jobs")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "delivery_jobs",
        },
        (payload) => {
          console.log("New job received:", payload);
          // Show notification for new job
          if (payload.new && (payload.new as any).status === "pending") {
            const newJob = payload.new as any;
            toast({
              title: "🚚 New Job Available!",
              description: `Delivery to ${newJob.delivery_address?.city || 'nearby'} - ${newJob.earnings ? `R${newJob.earnings}` : 'Check details'}`,
              duration: 10000,
            });
            // Play notification sound if available
            playNotificationSound();
          }
          fetchAvailableJobs();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "delivery_jobs",
        },
        () => {
          fetchAvailableJobs();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "delivery_jobs",
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

  const playNotificationSound = () => {
    try {
      // Create a simple notification beep using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.2);
      
      // Play second beep
      setTimeout(() => {
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        osc2.frequency.value = 1000;
        osc2.type = 'sine';
        gain2.gain.value = 0.3;
        osc2.start();
        osc2.stop(audioContext.currentTime + 0.2);
      }, 250);
    } catch (error) {
      console.log("Audio notification not supported");
    }
  };

  const fetchAvailableJobs = async () => {
    try {
      const { data, error } = await supabase
        .from("delivery_jobs")
        .select("*")
        .is("driver_id", null)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (error) throw error;
      setJobs((data as unknown as DeliveryJob[]) || []);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch available jobs",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptJob = async (jobId: string) => {
    if (driver.status !== "available") {
      toast({
        variant: "destructive",
        title: "Cannot Accept Job",
        description: "Set your status to 'Available' to accept jobs",
      });
      return;
    }

    setAccepting(jobId);

    try {
      // First check if job is still available (first-come-first-served)
      const { data: currentJob, error: checkError } = await supabase
        .from("delivery_jobs")
        .select("driver_id, status")
        .eq("id", jobId)
        .single();

      if (checkError) throw checkError;

      if (currentJob.driver_id || currentJob.status !== "pending") {
        toast({
          variant: "destructive",
          title: "Job Unavailable",
          description: "This job has already been claimed by another driver",
        });
        fetchAvailableJobs();
        return;
      }

      // Accept the job
      const { error } = await supabase
        .from("delivery_jobs")
        .update({
          driver_id: driver.id,
          status: "accepted",
        })
        .eq("id", jobId)
        .eq("status", "pending")
        .is("driver_id", null);

      if (error) throw error;

      // Update driver status to busy
      await supabase
        .from("drivers")
        .update({ status: "busy" })
        .eq("id", driver.id);

      toast({
        title: "Job Accepted!",
        description: "Navigate to pickup location to collect the order",
      });

      onJobAccepted();
      fetchAvailableJobs();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to accept job",
      });
    } finally {
      setAccepting(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(amount);
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
        <div>
          <h2 className="text-xl font-semibold">Available Jobs</h2>
          <p className="text-muted-foreground">
            {jobs.length} {jobs.length === 1 ? "job" : "jobs"} waiting
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAvailableJobs}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {driver.status !== "available" && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="pt-4">
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              Set your status to "Available" to accept jobs
            </p>
          </CardContent>
        </Card>
      )}

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="font-semibold mb-2">No Jobs Available</h3>
            <p className="text-sm text-muted-foreground">
              New jobs will appear here. Stay online to get notified!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {jobs.map((job) => (
            <Card key={job.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {format(new Date(job.created_at), "HH:mm")}
                  </Badge>
                  {job.earnings && (
                    <span className="font-bold text-green-600">
                      {formatCurrency(job.earnings)}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Route Display */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 h-3 w-3 rounded-full bg-green-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">PICKUP</p>
                      <p className="text-sm truncate">
                        {job.pickup_address.street}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {job.pickup_address.city}, {job.pickup_address.province}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 pl-1">
                    <div className="border-l-2 border-dashed h-6 ml-[5px]" />
                    {job.distance_km && (
                      <Badge variant="secondary" className="text-xs">
                        {job.distance_km} km
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="mt-1 h-3 w-3 rounded-full bg-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">DELIVERY</p>
                      <p className="text-sm truncate">
                        {job.delivery_address.street}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {job.delivery_address.city}, {job.delivery_address.province}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Job Info */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {job.estimated_delivery_time && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>
                        ETA: {format(new Date(job.estimated_delivery_time), "HH:mm")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Accept Button */}
                <Button
                  className="w-full"
                  onClick={() => handleAcceptJob(job.id)}
                  disabled={accepting === job.id || driver.status !== "available"}
                >
                  {accepting === job.id ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Accepting...
                    </>
                  ) : (
                    <>
                      Accept Job
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default DriverAvailableJobs;
