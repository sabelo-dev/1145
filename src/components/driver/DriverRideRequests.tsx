/// <reference types="google.maps" />
import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin, Navigation, Clock, DollarSign, Car, RefreshCw, Check, X, Route, ChevronRight, Loader2, Radio,
} from "lucide-react";
import { format } from "date-fns";
import GoogleMap from "@/components/maps/GoogleMap";
import { ridePricing, type DriverEarningsEstimate } from "@/services/ridePricingService";

interface Driver {
  id: string;
  name: string;
  status: string;
}

interface DriverRideRequestsProps {
  driver: Driver | null;
  onRideAccepted: () => void;
}

const rand = (value: number) => `R${value.toFixed(2)}`;

/** Expected net earnings for one request, shown before the driver accepts. */
const EarningsEstimate: React.FC<{ estimate: DriverEarningsEstimate }> = ({ estimate }) => {
  const { net_earnings: net, fuel_cost: fuel } = estimate;
  return (
    <div className="rounded-xl bg-muted/50 p-3 text-sm">
      {net === null || fuel === null ? (
        <>
          <p className="font-semibold">You are paid {rand(estimate.driver_payout)}</p>
          <p className="text-xs text-muted-foreground">Fuel cost is not shown: no fuel price is on record for this area yet.</p>
        </>
      ) : (
        <>
          <p className={net > 0 ? "font-semibold text-emerald-700 dark:text-emerald-400" : "font-semibold text-destructive"}>
            About {rand(net)} after fuel
          </p>
          <p className="text-xs text-muted-foreground">
            {rand(estimate.driver_payout)} paid to you, less about {rand(fuel)} fuel ({estimate.fuel_litres.toFixed(1)} L at{" "}
            {rand(estimate.fuel_price!)}/L).{" "}
            {estimate.pickup_km === null
              ? "Excludes the drive to the pickup: turn on location to include it."
              : `Includes ${estimate.pickup_km.toFixed(1)} km to the pickup`}
            {estimate.pickup_km === null ? "" : ` and about ${estimate.idle_minutes} min idling.`}
          </p>
        </>
      )}
    </div>
  );
};

const DriverRideRequests: React.FC<DriverRideRequestsProps> = ({ driver, onRideAccepted }) => {
  const [rides, setRides] = useState<any[]>([]);
  const [activeRide, setActiveRide] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();
  // What each open request should leave the driver after fuel.
  const [estimates, setEstimates] = useState<Record<string, DriverEarningsEstimate>>({});
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setPosition({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { maximumAge: 60_000, timeout: 10_000 },
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    ridePricing.driverEstimates(rides.map((r) => r.id), position).then((result) => {
      if (!cancelled) setEstimates(result);
    });
    return () => { cancelled = true; };
  }, [rides, position]);

  const fetchRideRequests = useCallback(async () => {
    setLoading(true);
    // Nearby requests are displayed by the dashboard offer panel.
    setRides([]);
    setLoading(false);
  }, []);

  const fetchActiveRide = useCallback(async () => {
    if (!driver) return;
    const { data } = await supabase
      .from("rides")
      .select("*")
      .eq("driver_id", driver.id)
      .in("status", ["accepted", "arriving", "arrived", "in_progress"])
      .maybeSingle();
    setActiveRide(data || null);
  }, [driver]);

  useEffect(() => {
    if (driver) {
      fetchRideRequests();
      fetchActiveRide();
    }
    const channel = supabase
      .channel("driver_ride_requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, () => {
        fetchRideRequests();
        fetchActiveRide();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [driver, fetchRideRequests, fetchActiveRide]);

  const acceptRide = async (rideId: string) => {
    if (!driver) return;
    setActionLoading(rideId);
    const { error } = await supabase
      .from("rides")
      .update({ driver_id: driver.id, status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", rideId)
      .eq("status", "requested")
      .is("driver_id", null);

    if (error) {
      toast({ variant: "destructive", title: "Failed", description: "Ride may have been taken." });
    } else {
      toast({ title: "Ride Accepted!" });
      onRideAccepted();
      fetchRideRequests();
      fetchActiveRide();
    }
    setActionLoading(null);
  };

  const updateRideStatus = async (rideId: string, newStatus: string) => {
    setActionLoading(rideId);
    const updateData: Record<string, any> = { status: newStatus };
    if (newStatus === "arrived") updateData.arrived_at = new Date().toISOString();
    if (newStatus === "in_progress") updateData.started_at = new Date().toISOString();
    if (newStatus === "completed") updateData.completed_at = new Date().toISOString();
    if (newStatus === "cancelled") { updateData.cancelled_at = new Date().toISOString(); updateData.cancelled_by = "driver"; }

    const { error } = await supabase.from("rides").update(updateData as any).eq("id", rideId);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not update ride." });
    } else {
      const msg: Record<string, string> = {
        arriving: "Passenger notified you're on the way.",
        arrived: "Passenger notified you are at the pickup.",
        in_progress: "Trip started!",
        completed: "Trip completed!",
        cancelled: "Ride cancelled.",
      };
      toast({ title: "Updated", description: msg[newStatus] || "Done." });
      fetchActiveRide();
      onRideAccepted();
    }
    setActionLoading(null);
  };

  const openNav = (address: string, lat?: number, lng?: number) => {
    const dest = lat && lng ? `${lat},${lng}` : encodeURIComponent(address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`, "_blank");
  };

  if (loading && !activeRide) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Finding rides...</p>
      </div>
    );
  }

  const activeRideMapMarkers = activeRide ? [
    ...(activeRide.pickup_lat ? [{ position: { lat: Number(activeRide.pickup_lat), lng: Number(activeRide.pickup_lng) }, title: "Pickup", label: "A" }] : []),
    ...(activeRide.dropoff_lat ? [{ position: { lat: Number(activeRide.dropoff_lat), lng: Number(activeRide.dropoff_lng) }, title: "Dropoff", label: "B" }] : []),
  ] : [];

  const activeRideRoute = activeRide?.pickup_lat && activeRide?.dropoff_lat
    ? { origin: { lat: Number(activeRide.pickup_lat), lng: Number(activeRide.pickup_lng) }, destination: { lat: Number(activeRide.dropoff_lat), lng: Number(activeRide.dropoff_lng) } }
    : undefined;

  const statusSteps = ["accepted", "arriving", "arrived", "in_progress", "completed"];
  const currentStepIndex = activeRide ? statusSteps.indexOf(activeRide.status) : -1;

  return (
    <div className="space-y-6">
      {/* Active Ride */}
      {activeRide && (
        <Card className="overflow-hidden border-0 shadow-xl ring-2 ring-primary/20">
          <div className="bg-gradient-to-r from-primary to-primary/80 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-primary-foreground">
              <div className="p-1.5 rounded-lg bg-primary-foreground/15">
                <Car className="h-4 w-4" />
              </div>
              <span className="font-semibold text-sm">Active Ride</span>
            </div>
            <Badge className="bg-primary-foreground/20 text-primary-foreground border-0 capitalize text-xs">
              {activeRide.status.replace("_", " ")}
            </Badge>
          </div>

          {/* Progress stepper */}
          <div className="px-5 pt-4">
            <div className="flex items-center justify-between mb-1">
              {statusSteps.slice(0, -1).map((step, i) => (
                <React.Fragment key={step}>
                  <div className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold transition-all ${i <= currentStepIndex ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground"}`}>
                    {i < currentStepIndex ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  {i < statusSteps.length - 2 && (
                    <div className={`flex-1 h-0.5 mx-1.5 rounded-full transition-all ${i < currentStepIndex ? "bg-primary" : "bg-muted"}`} />
                  )}
                </React.Fragment>
              ))}
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
              <span>Accepted</span>
              <span>On the way</span>
              <span>At pickup</span>
              <span>In Trip</span>
            </div>
          </div>

          <CardContent className="pt-4 space-y-4">
            {activeRideMapMarkers.length > 0 && (
              <GoogleMap
                className="w-full h-44 rounded-xl overflow-hidden ring-1 ring-border"
                markers={activeRideMapMarkers}
                route={activeRideRoute}
                center={activeRideMapMarkers[0]?.position || { lat: -26.2041, lng: 28.0473 }}
                zoom={13}
              />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40">
                <div className="p-2 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pickup</p>
                  <p className="font-medium text-sm truncate">{activeRide.pickup_address}</p>
                  {["accepted", "arriving"].includes(activeRide.status) && (
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs text-emerald-600" onClick={() => openNav(activeRide.pickup_address, activeRide.pickup_lat, activeRide.pickup_lng)}>
                      <Navigation className="h-3 w-3 mr-1" />Navigate
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40">
                <div className="p-2 rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20">
                  <Navigation className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Drop-off</p>
                  <p className="font-medium text-sm truncate">{activeRide.dropoff_address}</p>
                  {activeRide.status === "in_progress" && (
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs text-blue-600" onClick={() => openNav(activeRide.dropoff_address, activeRide.dropoff_lat, activeRide.dropoff_lng)}>
                      <Navigation className="h-3 w-3 mr-1" />Navigate
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 py-2">
              {activeRide.estimated_fare && (
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  <span>R{activeRide.estimated_fare.toFixed(2)}</span>
                </div>
              )}
              {activeRide.estimated_distance_km && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Route className="h-4 w-4" />
                  <span>{activeRide.estimated_distance_km.toFixed(1)} km</span>
                </div>
              )}
              {activeRide.estimated_duration_minutes && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{activeRide.estimated_duration_minutes} min</span>
                </div>
              )}
            </div>

            <Separator />

            <div className="flex gap-2.5">
              {activeRide.status === "accepted" && (
                <Button className="flex-1 h-11 rounded-xl font-semibold" onClick={() => updateRideStatus(activeRide.id, "arriving")} disabled={!!actionLoading}>
                  <Navigation className="h-4 w-4 mr-2" />Drive to Pickup
                </Button>
              )}
              {activeRide.status === "arriving" && (
                <Button className="flex-1 h-11 rounded-xl font-semibold" onClick={() => updateRideStatus(activeRide.id, "arrived")} disabled={!!actionLoading}>
                  <MapPin className="h-4 w-4 mr-2" />At Pickup
                </Button>
              )}
              {activeRide.status === "arrived" && (
                <Button className="flex-1 h-11 rounded-xl font-semibold" onClick={() => updateRideStatus(activeRide.id, "in_progress")} disabled={!!actionLoading}>
                  <Car className="h-4 w-4 mr-2" />Start Trip
                </Button>
              )}
              {activeRide.status === "in_progress" && (
                <Button className="flex-1 h-11 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-700" onClick={() => updateRideStatus(activeRide.id, "completed")} disabled={!!actionLoading}>
                  <Check className="h-4 w-4 mr-2" />Complete Trip
                </Button>
              )}
              {activeRide.status !== "in_progress" && (
                <Button variant="outline" className="h-11 rounded-xl" onClick={() => updateRideStatus(activeRide.id, "cancelled")} disabled={!!actionLoading}>
                  <X className="h-4 w-4 mr-2" />Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Incoming requests header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h2 className="text-xl font-bold">Incoming Requests</h2>
          {rides.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5">
              <Radio className="h-3 w-3 text-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-600">{rides.length} new</span>
            </div>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={fetchRideRequests} className="rounded-xl">
          <RefreshCw className="h-4 w-4 mr-2" />Refresh
        </Button>
      </div>

      {rides.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center py-16">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-muted mb-4">
              <Car className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-1.5 text-lg">Nearby offers appear above</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">New ride requests will appear here in real-time. Stay online to receive requests.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rides.map((ride) => {
            const hasCoords = ride.pickup_lat && ride.dropoff_lat;
            return (
              <Card key={ride.id} className="overflow-hidden hover:shadow-lg transition-all duration-200 group border-0 ring-1 ring-border hover:ring-primary/30">
                <CardContent className="p-0">
                  {hasCoords && (
                    <GoogleMap
                      className="w-full h-32 border-b border-border"
                      markers={[
                        { position: { lat: Number(ride.pickup_lat), lng: Number(ride.pickup_lng) }, title: "Pickup", label: "A" },
                        { position: { lat: Number(ride.dropoff_lat), lng: Number(ride.dropoff_lng) }, title: "Dropoff", label: "B" },
                      ]}
                      route={{
                        origin: { lat: Number(ride.pickup_lat), lng: Number(ride.pickup_lng) },
                        destination: { lat: Number(ride.dropoff_lat), lng: Number(ride.dropoff_lng) },
                      }}
                      center={{ lat: Number(ride.pickup_lat), lng: Number(ride.pickup_lng) }}
                      zoom={12}
                    />
                  )}
                  <div className="p-4 space-y-3">
                    {/* Addresses */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-lg bg-emerald-500/10">
                          <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Pickup</p>
                          <p className="font-medium text-sm truncate">{ride.pickup_address}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-lg bg-blue-500/10">
                          <Navigation className="h-3.5 w-3.5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Drop-off</p>
                          <p className="font-medium text-sm truncate">{ride.dropoff_address}</p>
                        </div>
                      </div>
                    </div>

                    {estimates[ride.id] && <EarningsEstimate estimate={estimates[ride.id]} />}

                    <Separator />

                    {/* Stats + Action */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {ride.estimated_distance_km && (
                          <Badge variant="secondary" className="rounded-full text-xs">
                            <Route className="h-3 w-3 mr-1" />{ride.estimated_distance_km.toFixed(1)} km
                          </Badge>
                        )}
                        {ride.estimated_fare && (
                          <Badge className="rounded-full bg-emerald-600 text-xs font-semibold">
                            R{ride.estimated_fare.toFixed(2)}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground ml-1">
                          <Clock className="h-3 w-3 inline mr-0.5" />{format(new Date(ride.created_at), "p")}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        className="rounded-xl h-9 px-4 font-semibold bg-emerald-600 hover:bg-emerald-700 shadow-sm"
                        onClick={() => acceptRide(ride.id)}
                        disabled={!!actionLoading || !!activeRide || driver?.status !== "available"}
                      >
                        {actionLoading === ride.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1.5" />Accept</>}
                      </Button>
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

export default DriverRideRequests;
