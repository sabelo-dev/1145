import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Car, MapPin, Navigation, Clock, Star, DollarSign,
  Plus, History, Activity, Route, TrendingUp,
} from "lucide-react";
import { format } from "date-fns";

const ConsumerRides: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("active");

  const fetchRides = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("rides")
      .select("*")
      .eq("passenger_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) setRides(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchRides();
  }, [fetchRides]);

  const activeRides = rides.filter((r) => !["completed", "cancelled"].includes(r.status));
  const completedRides = rides.filter((r) => r.status === "completed");
  const cancelledRides = rides.filter((r) => r.status === "cancelled");

  const totalSpent = completedRides.reduce((s, r) => s + (r.actual_fare || r.estimated_fare || 0), 0);

  const statCards = [
    { label: "Total Rides", value: completedRides.length.toString(), icon: Car, color: "text-primary", bg: "bg-primary/10" },
    { label: "Total Spent", value: `R${totalSpent.toFixed(2)}`, icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { label: "Active", value: activeRides.length.toString(), icon: Activity, color: "text-blue-600", bg: "bg-blue-500/10" },
  ];

  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    requested: { label: "Requested", variant: "outline" },
    searching: { label: "Finding Driver", variant: "outline" },
    accepted: { label: "Driver Assigned", variant: "secondary" },
    arriving: { label: "Driver Arriving", variant: "secondary" },
    in_progress: { label: "In Progress", variant: "default" },
    completed: { label: "Completed", variant: "secondary" },
    cancelled: { label: "Cancelled", variant: "destructive" },
  };

  const renderRideCard = (ride: any) => {
    const config = statusConfig[ride.status] || { label: ride.status, variant: "outline" as const };
    return (
      <Card key={ride.id} className="border-0 ring-1 ring-border hover:ring-primary/20 transition-all">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${ride.status === "completed" ? "bg-emerald-500/10" : ride.status === "cancelled" ? "bg-destructive/10" : "bg-primary/10"}`}>
              <Car className={`h-5 w-5 ${ride.status === "completed" ? "text-emerald-600" : ride.status === "cancelled" ? "text-destructive" : "text-primary"}`} />
            </div>

            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5 text-sm">
                <MapPin className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                <span className="truncate font-medium">{ride.pickup_address}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Navigation className="h-3 w-3 text-blue-500 flex-shrink-0" />
                <span className="truncate">{ride.dropoff_address}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {format(new Date(ride.created_at), "PPp")}
              </p>
            </div>

            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <Badge variant={config.variant} className="rounded-full text-xs capitalize">
                {config.label}
              </Badge>
              {(ride.actual_fare || ride.estimated_fare) && (
                <span className="font-bold text-sm">
                  R{(ride.actual_fare || ride.estimated_fare).toFixed(2)}
                </span>
              )}
              {ride.rating_by_passenger && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                  {ride.rating_by_passenger}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="border-0 ring-1 ring-border">
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

      {/* Request Ride Button */}
      <Button onClick={() => navigate("/rides/request")} className="rounded-xl gap-2">
        <Plus className="h-4 w-4" />
        Request a Ride
      </Button>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="rounded-xl">
          <TabsTrigger value="active" className="rounded-lg gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Active ({activeRides.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="rounded-lg gap-1.5">
            <History className="h-3.5 w-3.5" /> Completed ({completedRides.length})
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="rounded-lg gap-1.5">
            Cancelled ({cancelledRides.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4 space-y-2.5">
          {activeRides.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="pt-6 text-center py-16">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-muted mb-4">
                  <Car className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-1">No Active Rides</h3>
                <p className="text-sm text-muted-foreground">Request a ride to get started.</p>
              </CardContent>
            </Card>
          ) : (
            activeRides.map(renderRideCard)
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4 space-y-2.5">
          {completedRides.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="pt-6 text-center py-16">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-muted mb-4">
                  <History className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-1">No Ride History</h3>
                <p className="text-sm text-muted-foreground">Your completed rides will appear here.</p>
              </CardContent>
            </Card>
          ) : (
            completedRides.map(renderRideCard)
          )}
        </TabsContent>

        <TabsContent value="cancelled" className="mt-4 space-y-2.5">
          {cancelledRides.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="pt-6 text-center py-16">
                <p className="text-sm text-muted-foreground">No cancelled rides.</p>
              </CardContent>
            </Card>
          ) : (
            cancelledRides.map(renderRideCard)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConsumerRides;
