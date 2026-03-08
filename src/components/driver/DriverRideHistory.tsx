import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Navigation, DollarSign, Clock, Star, Car, TrendingUp, Route } from "lucide-react";
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

  const fetchHistory = useCallback(async () => {
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
  }, [driver]);

  useEffect(() => {
    if (driver) fetchHistory();
  }, [driver, fetchHistory]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-8 w-40" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  const statCards = [
    {
      label: "Total Rides",
      value: stats.totalRides.toString(),
      icon: Car,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Ride Earnings",
      value: `R${stats.totalEarnings.toFixed(2)}`,
      icon: TrendingUp,
      color: "text-emerald-600",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Avg Rating",
      value: stats.avgRating ? stats.avgRating.toFixed(1) : "N/A",
      icon: Star,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="border-0 ring-1 ring-border overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                  <p className="text-2xl font-black mt-1.5 tracking-tight">{stat.value}</p>
                </div>
                <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <h2 className="text-xl font-bold">Ride History</h2>

      {rides.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center py-16">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-muted mb-4">
              <Car className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-1">No Ride History</h3>
            <p className="text-sm text-muted-foreground">Your completed rides will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {rides.map((ride) => (
            <Card key={ride.id} className="border-0 ring-1 ring-border hover:ring-primary/20 transition-all">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Left: Status indicator */}
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${ride.status === "completed" ? "bg-emerald-500/10" : "bg-destructive/10"}`}>
                    <Car className={`h-5 w-5 ${ride.status === "completed" ? "text-emerald-600" : "text-destructive"}`} />
                  </div>

                  {/* Center: Route info */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 text-sm">
                      <MapPin className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                      <span className="truncate font-medium">{ride.pickup_address}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Navigation className="h-3 w-3 text-blue-500 flex-shrink-0" />
                      <span className="truncate">{ride.dropoff_address}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{format(new Date(ride.created_at), "PPp")}</p>
                  </div>

                  {/* Right: Stats */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <Badge variant={ride.status === "completed" ? "secondary" : "destructive"} className="rounded-full text-xs capitalize">
                      {ride.status}
                    </Badge>
                    {ride.actual_fare && (
                      <span className="font-bold text-sm">R{ride.actual_fare.toFixed(2)}</span>
                    )}
                    {ride.rating_by_passenger && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Star className="h-3 w-3 text-amber-500 fill-amber-500" />{ride.rating_by_passenger}
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
