import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, MessageSquare, MapPin, Navigation, Clock, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const statusLabels: Record<string, { label: string; color: string }> = {
  requested: { label: "Finding a driver...", color: "bg-yellow-500" },
  searching: { label: "Searching for driver...", color: "bg-yellow-500" },
  driver_assigned: { label: "Driver assigned", color: "bg-blue-500" },
  driver_arriving: { label: "Driver is on the way", color: "bg-blue-500" },
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

  useEffect(() => {
    if (!rideId) return;
    fetchRide();

    const channel = supabase
      .channel(`ride-${rideId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rides", filter: `id=eq.${rideId}` }, (payload) => {
        setRide(payload.new);
        if (payload.new.status === "completed") setShowRating(true);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [rideId]);

  const fetchRide = async () => {
    if (!rideId) return;
    const { data, error } = await supabase.from("rides").select("*").eq("id", rideId).single();
    if (error) {
      toast({ variant: "destructive", title: "Ride not found" });
      navigate("/rides");
      return;
    }
    setRide(data);
    if (data.status === "completed" && !data.rating_by_passenger) setShowRating(true);
    setLoading(false);
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!ride) return null;

  const status = statusLabels[ride.status] || { label: ride.status, color: "bg-muted" };
  const canCancel = ["requested", "searching", "driver_assigned", "driver_arriving"].includes(ride.status);

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-[#3A0CA3] to-[#4361EE] text-white p-4">
        <div className="container mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => navigate("/rides")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Trip Status</h1>
            <p className="text-white/70 text-sm">{status.label}</p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-lg space-y-4">
        {/* Status Banner */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${status.color} animate-pulse`} />
              <span className="font-semibold text-lg">{status.label}</span>
            </div>
            {["requested", "searching"].includes(ride.status) && (
              <p className="text-sm text-muted-foreground mt-2">We're matching you with a nearby driver. Please wait...</p>
            )}
          </CardContent>
        </Card>

        {/* Trip Details */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center mt-1">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <div className="w-0.5 h-6 bg-border" />
                <div className="w-2.5 h-2.5 rounded-full bg-destructive" />
              </div>
              <div className="space-y-3 flex-1">
                <div>
                  <p className="text-xs text-muted-foreground">PICKUP</p>
                  <p className="text-sm font-medium">{ride.pickup_address}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">DROP-OFF</p>
                  <p className="text-sm font-medium">{ride.dropoff_address}</p>
                </div>
              </div>
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{ride.estimated_distance_km || ride.actual_distance_km || '—'} km</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>~{ride.estimated_duration_minutes || ride.actual_duration_minutes || '—'} min</span>
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
              <h3 className="font-semibold text-lg">Rate your trip</h3>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button key={star} onClick={() => setRating(star)} className="p-1">
                    <Star className={`h-8 w-8 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
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
