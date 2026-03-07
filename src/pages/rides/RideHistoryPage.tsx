import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Car, Clock, MapPin, Star, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const RideHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchRides();
  }, [user]);

  const fetchRides = async () => {
    const { data } = await supabase
      .from("rides")
      .select("*")
      .eq("passenger_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setRides(data || []);
    setLoading(false);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      completed: "default",
      cancelled: "destructive",
      in_progress: "secondary",
    };
    return <Badge variant={(map[status] || "outline") as any}>{status.replace("_", " ")}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-[#3A0CA3] to-[#4361EE] text-white p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => navigate("/services")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">My Rides</h1>
          </div>
          <Button size="sm" className="bg-white text-primary hover:bg-white/90" onClick={() => navigate("/rides/request")}>
            <Plus className="h-4 w-4 mr-1" /> New Ride
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-lg space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : rides.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <Car className="h-16 w-16 mx-auto text-muted-foreground/30" />
            <h3 className="text-lg font-semibold">No rides yet</h3>
            <p className="text-muted-foreground text-sm">Request your first ride to get started</p>
            <Button onClick={() => navigate("/rides/request")}>Request a Ride</Button>
          </div>
        ) : (
          rides.map(ride => (
            <Card key={ride.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/rides/track/${ride.id}`)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(ride.created_at), "dd MMM yyyy, HH:mm")}
                  </div>
                  {statusBadge(ride.status)}
                </div>
                <div className="flex items-start gap-2.5 mb-3">
                  <div className="flex flex-col items-center mt-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <div className="w-0.5 h-4 bg-border" />
                    <div className="w-2 h-2 rounded-full bg-destructive" />
                  </div>
                  <div className="flex-1 space-y-1 text-sm">
                    <p className="truncate">{ride.pickup_address}</p>
                    <p className="truncate">{ride.dropoff_address}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{ride.actual_distance_km || ride.estimated_distance_km || '—'} km</span>
                    <span>~{ride.actual_duration_minutes || ride.estimated_duration_minutes || '—'} min</span>
                  </div>
                  <span className="font-bold">R{(ride.actual_fare || ride.estimated_fare || 0).toFixed(2)}</span>
                </div>
                {ride.rating_by_passenger && (
                  <div className="flex items-center gap-1 mt-2">
                    {Array.from({ length: ride.rating_by_passenger }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default RideHistoryPage;
