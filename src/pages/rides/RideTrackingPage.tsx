import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Clock, Star, X, Loader2, RefreshCw, AlertTriangle, Car, Phone, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useRideMatching } from "@/hooks/useRideMatching";
import GoogleMap from "@/components/maps/GoogleMap";

const statusLabels: Record<string, { label: string; color: string; animate?: boolean }> = {
  requested: { label: "Finding a driver...", color: "bg-yellow-500", animate: true },
  searching: { label: "Searching for driver...", color: "bg-yellow-500", animate: true },
  accepted: { label: "Driver assigned!", color: "bg-primary" },
  arriving: { label: "Driver is on the way", color: "bg-blue-500" },
  arrived: { label: "Driver has arrived", color: "bg-emerald-500" },
  in_progress: { label: "Trip in progress", color: "bg-primary" },
  completed: { label: "Trip completed", color: "bg-emerald-600" },
  cancelled: { label: "Trip cancelled", color: "bg-destructive" },
  no_drivers: { label: "No drivers available", color: "bg-muted-foreground" },
};

const RideTrackingPage: React.FC = () => {
  const { rideId } = useParams<{ rideId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [ride, setRide] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [showRating, setShowRating] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [driverInfo, setDriverInfo] = useState<any>(null);

  // Driver matching hook - active when ride is in requested/searching status
  const isWaitingForDriver = ride && ["requested", "searching"].includes(ride.status) && !ride.driver_id;
  const {
    isSearching: isMatchingActive,
    driversNotified,
    attempt: matchAttempt,
    noDriversAvailable,
    retrySearch,
  } = useRideMatching({
    rideId: rideId || null,
    enabled: isWaitingForDriver,
  });

  useEffect(() => {
    if (!rideId) return;
    fetchRide();

    const channel = supabase
      .channel(`ride-${rideId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rides", filter: `id=eq.${rideId}` }, (payload) => {
        setRide(payload.new);
        if (payload.new.status === "completed") setShowRating(true);
        // Fetch driver info when driver assigned
        if ((payload.new as any).driver_id && !(payload.old as any)?.driver_id) {
          fetchDriverInfo((payload.new as any).driver_id);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [rideId]);

  // Subscribe to driver location updates
  useEffect(() => {
    if (!ride?.driver_id) return;

    fetchDriverInfo(ride.driver_id);

    const channel = supabase
      .channel(`driver-loc-${ride.driver_id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "drivers",
        filter: `id=eq.${ride.driver_id}`,
      }, (payload) => {
        const loc = (payload.new as any).current_location;
        if (loc?.lat && loc?.lng) {
          setDriverLocation({ lat: loc.lat, lng: loc.lng });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [ride?.driver_id]);

  const fetchRide = async () => {
    if (!rideId) return;
    const { data, error } = await supabase.from("rides").select("*").eq("id", rideId).single();
    if (error) {
      toast({ variant: "destructive", title: "Ride not found" });
      navigate("/rides");
      return;
    }
    setRide(data);
    if (data.driver_id) fetchDriverInfo(data.driver_id);
    if (data.status === "completed" && !data.rating_by_passenger) setShowRating(true);
    setLoading(false);
  };

  const fetchDriverInfo = async (driverId: string) => {
    const { data } = await supabase
      .from("drivers")
      .select("id, name, phone, rating, vehicle_type, vehicle_registration, current_location")
      .eq("id", driverId)
      .single();
    if (data) {
      setDriverInfo(data);
      const loc = data.current_location as any;
      if (loc?.lat && loc?.lng) setDriverLocation({ lat: loc.lat, lng: loc.lng });
    }
  };

  const handleCancel = async () => {
    if (!rideId) return;
    const { error } = await supabase.from("rides").update({
      status: "cancelled",
      cancelled_by: "passenger",
      cancellation_reason: "Cancelled by passenger",
      cancelled_at: new Date().toISOString(),
    }).eq("id", rideId);
    if (error) {
      toast({ variant: "destructive", title: "Failed to cancel ride" });
    } else {
      toast({ title: "Ride cancelled" });
    }
  };

  const handleRate = async () => {
    if (!rideId || rating === 0) return;
    await supabase.from("rides").update({ rating_by_passenger: rating }).eq("id", rideId);
    toast({ title: "Thanks for your rating!" });
    setShowRating(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!ride) return null;

  const status = statusLabels[ride.status] || { label: ride.status, color: "bg-muted" };
  const canCancel = ["requested", "searching", "accepted", "arriving"].includes(ride.status);

  const pickupCoords = ride.pickup_lat && ride.pickup_lng ? { lat: ride.pickup_lat, lng: ride.pickup_lng } : null;
  const dropoffCoords = ride.dropoff_lat && ride.dropoff_lng ? { lat: ride.dropoff_lat, lng: ride.dropoff_lng } : null;

  const mapMarkers = [
    ...(pickupCoords ? [{ position: pickupCoords, title: "Pickup", label: "A" }] : []),
    ...(dropoffCoords ? [{ position: dropoffCoords, title: "Drop-off", label: "B" }] : []),
  ];

  const mapRoute = pickupCoords && dropoffCoords ? { origin: pickupCoords, destination: dropoffCoords } : undefined;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-4">
        <div className="container mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/20" onClick={() => navigate("/rides")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Trip Status</h1>
            <p className="text-primary-foreground/70 text-sm">{status.label}</p>
          </div>
          {isWaitingForDriver && (
            <Badge className="bg-primary-foreground/20 text-primary-foreground border-0 animate-pulse">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Searching
            </Badge>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-lg space-y-4">
        {/* Live Map */}
        <GoogleMap
          className="w-full h-56 rounded-xl overflow-hidden border border-border"
          markers={mapMarkers}
          route={mapRoute}
          driverLocation={driverLocation || undefined}
          center={pickupCoords || { lat: -26.2041, lng: 28.0473 }}
          zoom={13}
        />

        {/* Driver Search Status */}
        {isWaitingForDriver && (
          <Card className="border-0 shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-yellow-500/10 to-primary/10 px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
                <span className="font-semibold text-sm text-foreground">Finding your driver</span>
              </div>
            </div>
            <CardContent className="p-4 space-y-3">
              {/* Search animation */}
              <div className="flex items-center justify-center py-4">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-primary/20 flex items-center justify-center">
                    <Car className="h-8 w-8 text-primary" />
                  </div>
                  <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-primary/40 animate-ping" />
                  <div className="absolute inset-[-8px] w-[calc(100%+16px)] h-[calc(100%+16px)] rounded-full border-2 border-primary/20 animate-pulse" />
                </div>
              </div>

              {driversNotified > 0 && (
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">
                    {driversNotified} driver{driversNotified > 1 ? "s" : ""} notified
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Waiting for a driver to accept...
                  </p>
                </div>
              )}

              {driversNotified === 0 && isMatchingActive && (
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">
                    Scanning for nearby drivers...
                  </p>
                  {matchAttempt > 1 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Expanding search area (attempt {matchAttempt}/5)
                    </p>
                  )}
                </div>
              )}

              {/* Progress dots */}
              <div className="flex justify-center gap-1.5 py-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i <= matchAttempt
                        ? "bg-primary"
                        : "bg-muted"
                    }`}
                    style={{ animationDelay: `${i * 200}ms` }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* No Drivers Alert */}
        {noDriversAvailable && ride.status === "no_drivers" && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-4 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <AlertTriangle className="h-7 w-7 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">No drivers available</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  All drivers in your area are currently busy. Would you like to try again?
                </p>
              </div>
              <Button onClick={retrySearch} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Search Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Driver Info Card */}
        {driverInfo && ride.driver_id && (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Car className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-foreground">{driverInfo.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {driverInfo.rating && (
                      <div className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs font-medium text-foreground">{driverInfo.rating.toFixed(1)}</span>
                      </div>
                    )}
                    {driverInfo.vehicle_type && (
                      <Badge variant="secondary" className="text-[10px] capitalize">{driverInfo.vehicle_type}</Badge>
                    )}
                    {driverInfo.vehicle_registration && (
                      <span className="text-xs text-muted-foreground">{driverInfo.vehicle_registration}</span>
                    )}
                  </div>
                </div>
                {driverInfo.phone && (
                  <a href={`tel:${driverInfo.phone}`} className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors">
                    <Phone className="h-4 w-4 text-primary" />
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Banner */}
        {!isWaitingForDriver && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${status.color} ${status.animate ? "animate-pulse" : ""}`} />
                <span className="font-semibold text-lg text-foreground">{status.label}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trip Details */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center mt-1">
                <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                <div className="w-0.5 h-6 bg-border" />
                <div className="w-2.5 h-2.5 rounded-full bg-destructive" />
              </div>
              <div className="space-y-3 flex-1">
                <div>
                  <p className="text-xs text-muted-foreground">PICKUP</p>
                  <p className="text-sm font-medium text-foreground">{ride.pickup_address}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">DROP-OFF</p>
                  <p className="text-sm font-medium text-foreground">{ride.dropoff_address}</p>
                </div>
              </div>
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{ride.estimated_distance_km || ride.actual_distance_km || "—"} km</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>~{ride.estimated_duration_minutes || ride.actual_duration_minutes || "—"} min</span>
              </div>
              <div className="font-bold text-foreground">
                R{(ride.actual_fare || ride.estimated_fare || 0).toFixed(2)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cancel Button */}
        {canCancel && (
          <Button variant="destructive" className="w-full" onClick={handleCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancel Ride
          </Button>
        )}

        {/* Rating */}
        {showRating && (
          <Card>
            <CardContent className="p-6 text-center space-y-4">
              <h3 className="font-semibold text-lg text-foreground">Rate your trip</h3>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setRating(star)} className="p-1">
                    <Star className={`h-8 w-8 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                  </button>
                ))}
              </div>
              <Button onClick={handleRate} disabled={rating === 0} className="w-full">
                Submit Rating
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Return to services */}
        {["completed", "cancelled", "no_drivers"].includes(ride.status) && (
          <Button variant="outline" className="w-full" onClick={() => navigate("/services")}>
            Back to Services
          </Button>
        )}
      </div>
    </div>
  );
};

export default RideTrackingPage;
