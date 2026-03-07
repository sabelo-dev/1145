import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Navigation, DollarSign, Clock, Star, Car } from "lucide-react";
import { format } from "date-fns";

interface Driver {
  id: string;
  name: string;
  status: string;
}

interface DriverRideHistoryProps {
  driver: Driver | null;
}

const DriverRideHistory: React.FC<DriverRideHistoryProps> = ({ driver }) => {
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalRides: 0, totalEarnings: 0, avgRating: 0 });

  useEffect(() => {
    if (driver) fetchHistory();
  }, [driver]);

  const fetchHistory = async () => {
    if (!driver) return;
    setLoading(true);
    const { data } = await supabase
      .from("rides")
      .select("*")
      .eq("driver_id", driver.id)
      .in("status", ["completed", "cancelled"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) {
      setRides(data);
      const completed = data.filter((r) => r.status === "completed");
      const totalEarnings = completed.reduce((s, r) => s + (r.actual_fare || r.estimated_fare || 0), 0);
      const ratings = completed.filter((r) => r.rating_by_passenger).map((r) => r.rating_by_passenger as number);
      setStats({
        totalRides: completed.length,
        totalEarnings,
        avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
      });
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rides</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.totalRides}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ride Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">R{stats.totalEarnings.toFixed(2)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.avgRating ? stats.avgRating.toFixed(1) : "N/A"}</div></CardContent>
        </Card>
      </div>

      <h2 className="text-xl font-semibold">Ride History</h2>

      {rides.length === 0 ? (
        <Card><CardContent className="pt-6 text-center py-12">
          <Car className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No ride history yet.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {rides.map((ride) => (
            <Card key={ride.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-3 w-3 text-primary" />
                      <span className="truncate max-w-xs">{ride.pickup_address}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Navigation className="h-3 w-3 text-accent-foreground" />
                      <span className="truncate max-w-xs">{ride.dropoff_address}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{format(new Date(ride.created_at), "PPp")}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={ride.status === "completed" ? "default" : "destructive"}>{ride.status}</Badge>
                    {ride.actual_fare && <span className="font-semibold text-sm">R{ride.actual_fare.toFixed(2)}</span>}
                    {ride.rating_by_passenger && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Star className="h-3 w-3 text-primary fill-primary" />{ride.rating_by_passenger}
                      </span>
                    )}
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

export default DriverRideHistory;
