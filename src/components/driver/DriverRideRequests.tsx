import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin,
  Navigation,
  Clock,
  DollarSign,
  User,
  Car,
  RefreshCw,
  Check,
  X,
  Phone,
} from "lucide-react";
import { format } from "date-fns";

interface Driver {
  id: string;
  name: string;
  status: string;
}

interface RideRequest {
  id: string;
  passenger_id: string;
  pickup_address: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_address: string;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  estimated_fare: number | null;
  estimated_distance_km: number | null;
  estimated_duration_min: number | null;
  status: string;
  created_at: string;
  passenger_name?: string;
  passenger_phone?: string;
  vehicle_type_name?: string;
}

interface DriverRideRequestsProps {
  driver: Driver | null;
  onRideAccepted: () => void;
}

const DriverRideRequests: React.FC<DriverRideRequestsProps> = ({ driver, onRideAccepted }) => {
  const [rides, setRides] = useState<RideRequest[]>([]);
  const [activeRide, setActiveRide] = useState<RideRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (driver) {
      fetchRideRequests();
      fetchActiveRide();
    }

    const channel = supabase
      .channel("driver_ride_requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rides" },
        () => {
          fetchRideRequests();
          fetchActiveRide();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driver]);

  const fetchRideRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("rides")
      .select("*")
      .eq("status", "requested")
      .is("driver_id", null)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setRides(data as RideRequest[]);
    }
    setLoading(false);
  };

  const fetchActiveRide = async () => {
    if (!driver) return;
    const { data } = await supabase
      .from("rides")
      .select("*")
      .eq("driver_id", driver.id)
      .in("status", ["accepted", "arriving", "in_progress"])
      .maybeSingle();

    if (data) {
      setActiveRide(data as RideRequest);
    } else {
      setActiveRide(null);
    }
  };

  const acceptRide = async (rideId: string) => {
    if (!driver) return;
    setActionLoading(rideId);

    const { error } = await supabase
      .from("rides")
      .update({ driver_id: driver.id, status: "accepted" })
      .eq("id", rideId)
      .eq("status", "requested")
      .is("driver_id", null);

    if (error) {
      toast({ variant: "destructive", title: "Failed", description: "Ride may have been taken by another driver." });
    } else {
      toast({ title: "Ride Accepted!", description: "Navigate to the pickup location." });
      onRideAccepted();
      fetchRideRequests();
      fetchActiveRide();
    }
    setActionLoading(null);
  };

  const updateRideStatus = async (rideId: string, newStatus: string) => {
    setActionLoading(rideId);
    const updateData: any = { status: newStatus };
    if (newStatus === "in_progress") updateData.started_at = new Date().toISOString();
    if (newStatus === "completed") updateData.completed_at = new Date().toISOString();

    const { error } = await supabase
      .from("rides")
      .update(updateData)
      .eq("id", rideId);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not update ride status." });
    } else {
      const messages: Record<string, string> = {
        arriving: "Passenger notified you're arriving.",
        in_progress: "Trip started!",
        completed: "Trip completed! Payment will be processed.",
      };
      toast({ title: "Status Updated", description: messages[newStatus] || "Ride updated." });
      fetchActiveRide();
      onRideAccepted();
    }
    setActionLoading(null);
  };

  if (loading && !activeRide) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Ride */}
      {activeRide && (
        <Card className="border-primary border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5 text-primary" />
              Active Ride
              <Badge className="ml-auto capitalize">{activeRide.status.replace("_", " ")}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <MapPin className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pickup</p>
                  <p className="font-medium text-sm">{activeRide.pickup_address}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Navigation className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Dropoff</p>
                  <p className="font-medium text-sm">{activeRide.dropoff_address}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm">
              {activeRide.estimated_fare && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  R{activeRide.estimated_fare.toFixed(2)}
                </span>
              )}
              {activeRide.estimated_distance_km && (
                <span className="flex items-center gap-1">
                  <Navigation className="h-4 w-4" />
                  {activeRide.estimated_distance_km.toFixed(1)} km
                </span>
              )}
              {activeRide.estimated_duration_min && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {activeRide.estimated_duration_min} min
                </span>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              {activeRide.status === "accepted" && (
                <Button onClick={() => updateRideStatus(activeRide.id, "arriving")} disabled={!!actionLoading}>
                  Arriving at Pickup
                </Button>
              )}
              {activeRide.status === "arriving" && (
                <Button onClick={() => updateRideStatus(activeRide.id, "in_progress")} disabled={!!actionLoading}>
                  Start Trip
                </Button>
              )}
              {activeRide.status === "in_progress" && (
                <Button onClick={() => updateRideStatus(activeRide.id, "completed")} disabled={!!actionLoading}>
                  <Check className="h-4 w-4 mr-2" />
                  Complete Trip
                </Button>
              )}
              {activeRide.status !== "in_progress" && (
                <Button
                  variant="destructive"
                  onClick={() => updateRideStatus(activeRide.id, "cancelled")}
                  disabled={!!actionLoading}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Ride Requests */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Incoming Ride Requests</h2>
        <Button variant="outline" size="sm" onClick={fetchRideRequests}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {rides.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <Car className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No Ride Requests</h3>
            <p className="text-sm text-muted-foreground">New ride requests will appear here in real-time.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rides.map((ride) => (
            <Card key={ride.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                        <MapPin className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Pickup</p>
                        <p className="font-medium text-sm">{ride.pickup_address}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <Navigation className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Dropoff</p>
                        <p className="font-medium text-sm">{ride.dropoff_address}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <div className="flex items-center gap-3">
                      {ride.estimated_distance_km && (
                        <Badge variant="outline">{ride.estimated_distance_km.toFixed(1)} km</Badge>
                      )}
                      {ride.estimated_fare && (
                        <Badge className="bg-green-600 text-white">R{ride.estimated_fare.toFixed(2)}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 inline mr-1" />
                      {format(new Date(ride.created_at), "p")}
                    </p>
                    <Button
                      onClick={() => acceptRide(ride.id)}
                      disabled={!!actionLoading || !!activeRide || driver?.status !== "available"}
                    >
                      {actionLoading === ride.id ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      Accept Ride
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

export default DriverRideRequests;
