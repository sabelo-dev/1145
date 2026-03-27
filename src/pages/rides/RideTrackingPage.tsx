import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, MapPin, Clock, Star, X, Loader2, RefreshCw, AlertTriangle,
  Car, Phone, MessageSquare, Shield, Share2, Navigation, Siren,
  CheckCircle2, CircleDot, Route,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useRideMatching } from "@/hooks/useRideMatching";
import { rideDispatchService } from "@/services/rideDispatchService";
import GoogleMap from "@/components/maps/GoogleMap";

const LIFECYCLE_STEPS = [
  { key: "requested", label: "Requested", icon: CircleDot },
  { key: "searching", label: "Finding Driver", icon: Loader2 },
  { key: "accepted", label: "Driver Matched", icon: CheckCircle2 },
  { key: "arriving", label: "En Route", icon: Navigation },
  { key: "arrived", label: "Arrived", icon: MapPin },
  { key: "in_progress", label: "Trip Active", icon: Route },
  { key: "completed", label: "Completed", icon: Star },
];

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
        if ((payload.new as any).driver_id && !(payload.old as any)?.driver_id) {
          fetchDriverInfo((payload.new as any).driver_id);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [rideId]);

  useEffect(() => {
    if (!ride?.driver_id) return;
    fetchDriverInfo(ride.driver_id);

    // Subscribe to driver_locations for real-time position
    const channel = supabase
      .channel(`driver-loc-track-${ride.driver_id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "driver_locations",
        filter: `driver_id=eq.${ride.driver_id}`,
      }, (payload) => {
        const loc = payload.new as any;
        if (loc?.latitude && loc?.longitude) {
          setDriverLocation({ lat: loc.latitude, lng: loc.longitude });
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
      .select("id, name, phone, rating, vehicle_type, vehicle_registration, current_location, total_deliveries")
      .eq("id", driverId)
      .single();
    if (data) {
      setDriverInfo(data);
      const loc = data.current_location as any;
      if (loc?.lat && loc?.lng) setDriverLocation({ lat: loc.lat, lng: loc.lng });
    }
  };

  const handleCancel = async () => {
    if (!rideId || !user) return;
    const success = await rideDispatchService.cancelRide(rideId, user.id);
    toast({ title: success ? "Ride cancelled" : "Failed to cancel ride", variant: success ? "default" : "destructive" });
  };

  const handleRate = async () => {
    if (!rideId || rating === 0) return;
    await supabase.from("rides").update({ rating_by_passenger: rating }).eq("id", rideId);
    toast({ title: "Thanks for your rating!" });
    setShowRating(false);
  };

  const handleShareRide = async () => {
    if (!rideId) return;
    const shareText = await rideDispatchService.shareRideDetails(rideId);
    if (navigator.share) {
      try { await navigator.share({ text: shareText }); } catch {}
    } else {
      await navigator.clipboard.writeText(shareText);
      toast({ title: "Trip details copied to clipboard" });
    }
  };

  const handleSOS = async () => {
    if (!rideId || !user) return;
    await rideDispatchService.triggerSOS(rideId, user.id);
    toast({
      variant: "destructive",
      title: "🆘 SOS Activated",
      description: "Emergency services have been notified. Stay calm.",
    });
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
  const isActive = ["accepted", "arriving", "arrived", "in_progress"].includes(ride.status);
  const pickupCoords = ride.pickup_lat && ride.pickup_lng ? { lat: ride.pickup_lat, lng: ride.pickup_lng } : null;
  const dropoffCoords = ride.dropoff_lat && ride.dropoff_lng ? { lat: ride.dropoff_lat, lng: ride.dropoff_lng } : null;

  const mapMarkers = [
    ...(pickupCoords ? [{ position: pickupCoords, title: "Pickup", label: "A" }] : []),
    ...(dropoffCoords ? [{ position: dropoffCoords, title: "Drop-off", label: "B" }] : []),
  ];
  const mapRoute = pickupCoords && dropoffCoords ? { origin: pickupCoords, destination: dropoffCoords } : undefined;

  // Get current lifecycle step index
  const currentStepIndex = LIFECYCLE_STEPS.findIndex((s) => s.key === ride.status);

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
          <div className="flex items-center gap-2">
            {isActive && (
              <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/20" onClick={handleShareRide}>
                <Share2 className="h-5 w-5" />
              </Button>
            )}
            {isWaitingForDriver && (
              <Badge className="bg-primary-foreground/20 text-primary-foreground border-0 animate-pulse">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Searching
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-lg space-y-4">
        {/* Live Map */}
        <GoogleMap
          className="w-full h-56 rounded-xl overflow-hidden border border-border"
          markers={mapMarkers}
          route={mapRoute}
          driverLocation={driverLocation || undefined}
          center={driverLocation || pickupCoords || { lat: -26.2041, lng: 28.0473 }}
          zoom={13}
        />

        {/* Trip Lifecycle Progress */}
        {!["cancelled", "no_drivers"].includes(ride.status) && (
          <div className="flex items-center justify-between px-2">
            {LIFECYCLE_STEPS.map((step, i) => {
              const isCompleted = i < currentStepIndex;
              const isCurrent = i === currentStepIndex;
              const StepIcon = step.icon;
              return (
                <React.Fragment key={step.key}>
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                      isCompleted ? "bg-emerald-500 text-white" :
                      isCurrent ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <StepIcon className={`h-3.5 w-3.5 ${isCurrent ? "animate-pulse" : ""}`} />}
                    </div>
                    <span className={`text-[8px] font-medium ${isCurrent ? "text-primary" : isCompleted ? "text-emerald-600" : "text-muted-foreground"}`}>
                      {step.label}
                    </span>
                  </div>
                  {i < LIFECYCLE_STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-0.5 rounded ${
                      i < currentStepIndex ? "bg-emerald-500" : "bg-border"
                    }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Driver Search Status */}
        {isWaitingForDriver && (
          <Card className="border-0 shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-yellow-500/10 to-primary/10 px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="font-semibold text-sm text-foreground">Finding your driver</span>
              </div>
            </div>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-center py-4">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-primary/20 flex items-center justify-center">
                    <Car className="h-8 w-8 text-primary" />
                  </div>
                  <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-primary/40 animate-ping" />
                </div>
              </div>

              {driversNotified > 0 && (
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">
                    {driversNotified} driver{driversNotified > 1 ? "s" : ""} notified
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Waiting for acceptance...</p>
                </div>
              )}

              {driversNotified === 0 && isMatchingActive && (
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Scanning for nearby drivers...</p>
                  {matchAttempt > 1 && (
                    <p className="text-xs text-muted-foreground mt-1">Expanding search area (attempt {matchAttempt}/5)</p>
                  )}
                </div>
              )}

              <div className="flex justify-center gap-1.5 py-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className={`w-2 h-2 rounded-full transition-all ${i <= matchAttempt ? "bg-primary" : "bg-muted"}`} />
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
                <p className="text-sm text-muted-foreground mt-1">All drivers in your area are currently busy.</p>
              </div>
              <Button onClick={retrySearch} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />Search Again
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
                    {driverInfo.total_deliveries && (
                      <span className="text-xs text-muted-foreground">{driverInfo.total_deliveries} trips</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {driverInfo.phone && (
                    <a href={`tel:${driverInfo.phone}`} className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors">
                      <Phone className="h-4 w-4 text-primary" />
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Banner */}
        {!isWaitingForDriver && !["cancelled", "no_drivers"].includes(ride.status) && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${status.color} ${(status as any).animate ? "animate-pulse" : ""}`} />
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
                {ride.surge_multiplier > 1 && (
                  <span className="text-[10px] text-orange-500 ml-1">⚡{ride.surge_multiplier}x</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Safety Actions */}
        {isActive && (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleShareRide}>
              <Share2 className="h-4 w-4 mr-2" />Share Trip
            </Button>
            <Button variant="destructive" size="icon" onClick={handleSOS} title="Emergency SOS">
              <Siren className="h-5 w-5" />
            </Button>
          </div>
        )}

        {/* Cancel Button */}
        {canCancel && (
          <Button variant="destructive" className="w-full" onClick={handleCancel}>
            <X className="h-4 w-4 mr-2" />Cancel Ride
          </Button>
        )}

        {/* Rating */}
        {showRating && (
          <Card>
            <CardContent className="p-6 text-center space-y-4">
              <h3 className="font-semibold text-lg text-foreground">Rate your trip</h3>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setRating(star)} className="p-1 transition-transform hover:scale-110">
                    <Star className={`h-8 w-8 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                  </button>
                ))}
              </div>
              <Button onClick={handleRate} disabled={rating === 0} className="w-full">Submit Rating</Button>
            </CardContent>
          </Card>
        )}

        {["completed", "cancelled", "no_drivers"].includes(ride.status) && (
          <Button variant="outline" className="w-full" onClick={() => navigate("/services")}>Back to Services</Button>
        )}
      </div>
    </div>
  );
};

export default RideTrackingPage;
