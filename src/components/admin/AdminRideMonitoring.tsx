import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Car, MapPin, Users, Activity, RefreshCw, AlertTriangle, Clock, Ban,
  Navigation, Eye,
} from "lucide-react";
import { format } from "date-fns";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import GoogleMap from "@/components/maps/GoogleMap";

const statusColors: Record<string, string> = {
  requested: "bg-yellow-500",
  searching: "bg-yellow-500",
  accepted: "bg-blue-400",
  driver_assigned: "bg-blue-500",
  driver_arriving: "bg-blue-500",
  arriving: "bg-blue-500",
  arrived: "bg-emerald-500",
  in_progress: "bg-primary",
  completed: "bg-emerald-600",
  cancelled: "bg-destructive",
  no_drivers: "bg-muted-foreground",
};

const AdminRideMonitoring: React.FC = () => {
  const [rides, setRides] = useState<any[]>([]);
  const [stats, setStats] = useState({ active: 0, requested: 0, completed: 0, cancelled: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedRide, setSelectedRide] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("active");
  const { toast } = useToast();

  useEffect(() => {
    fetchRides();
    fetchStats();

    const channel = supabase
      .channel("admin-rides-monitor")
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, () => {
        fetchRides();
        fetchStats();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [filterStatus]);

  const fetchStats = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: all } = await supabase.from("rides").select("status");
    if (all) {
      const active = all.filter(r => ["accepted", "arriving", "driver_arriving", "in_progress"].includes(r.status)).length;
      const requested = all.filter(r => ["requested", "searching"].includes(r.status)).length;
      const completed = all.filter(r => r.status === "completed").length;
      const cancelled = all.filter(r => r.status === "cancelled").length;
      setStats({ active, requested, completed, cancelled });
    }
  };

  const fetchRides = async () => {
    setLoading(true);
    let query = supabase.from("rides").select("*").order("created_at", { ascending: false }).limit(100);

    if (filterStatus === "active") {
      query = query.in("status", ["accepted", "arriving", "driver_arriving", "in_progress"]);
    } else if (filterStatus === "requested") {
      query = query.in("status", ["requested", "searching"]);
    } else if (filterStatus !== "all") {
      query = query.eq("status", filterStatus);
    }

    const { data } = await query;
    setRides(data || []);
    setLoading(false);
  };

  const handleCancelRide = async (rideId: string) => {
    const { error } = await supabase.from("rides").update({
      status: "cancelled",
      cancelled_by: "admin",
      cancellation_reason: "Cancelled by platform admin",
      cancelled_at: new Date().toISOString(),
    }).eq("id", rideId);

    if (error) {
      toast({ variant: "destructive", title: "Failed to cancel ride" });
    } else {
      toast({ title: "Ride cancelled by admin" });
      setDetailOpen(false);
    }
  };

  const openDetail = (ride: any) => {
    setSelectedRide(ride);
    setDetailOpen(true);
  };

  const statCards = [
    { label: "Active Rides", value: stats.active, icon: Car, color: "text-blue-500" },
    { label: "Waiting for Driver", value: stats.requested, icon: Clock, color: "text-yellow-500" },
    { label: "Completed Today", value: stats.completed, icon: Activity, color: "text-emerald-500" },
    { label: "Cancelled", value: stats.cancelled, icon: Ban, color: "text-destructive" },
  ];

  // Collect driver locations for the overview map
  const mapMarkers = rides
    .filter(r => r.pickup_lat && r.pickup_lng)
    .map(r => ({
      position: { lat: Number(r.pickup_lat), lng: Number(r.pickup_lng) },
      title: `Ride ${r.id.slice(0, 8)}`,
      label: r.status === "in_progress" ? "🚗" : "📍",
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Ride Monitoring</h2>
          <p className="text-muted-foreground">Real-time oversight of all ride operations</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchRides(); fetchStats(); }}>
          <RefreshCw className="h-4 w-4 mr-2" />Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(s => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <s.icon className={`h-8 w-8 ${s.color}`} />
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Live Map */}
      {mapMarkers.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" />Live Ride Map</CardTitle></CardHeader>
          <CardContent>
            <GoogleMap
              className="w-full h-72 rounded-xl overflow-hidden"
              markers={mapMarkers}
              center={mapMarkers[0]?.position || { lat: -26.2041, lng: 28.0473 }}
              zoom={11}
            />
          </CardContent>
        </Card>
      )}

      {/* Filter & List */}
      <div className="flex items-center gap-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter rides" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Rides</SelectItem>
            <SelectItem value="active">Active Rides</SelectItem>
            <SelectItem value="requested">Waiting for Driver</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">{rides.length} rides</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : rides.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <Car className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No rides found for this filter.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rides.map(ride => (
            <Card key={ride.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openDetail(ride)}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full ${statusColors[ride.status] || "bg-muted"} ${["requested", "searching", "in_progress"].includes(ride.status) ? "animate-pulse" : ""}`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{ride.pickup_address} → {ride.dropoff_address}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(ride.created_at), "MMM d, HH:mm")} · {ride.estimated_distance_km?.toFixed(1) || "—"} km · R{(ride.actual_fare || ride.estimated_fare || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize text-xs">{ride.status.replace("_", " ")}</Badge>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openDetail(ride); }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ride Details</DialogTitle>
            <DialogDescription>Ride ID: {selectedRide?.id?.slice(0, 8)}...</DialogDescription>
          </DialogHeader>
          {selectedRide && (
            <div className="space-y-4">
              {selectedRide.pickup_lat && selectedRide.dropoff_lat && (
                <GoogleMap
                  className="w-full h-44 rounded-xl overflow-hidden"
                  markers={[
                    { position: { lat: Number(selectedRide.pickup_lat), lng: Number(selectedRide.pickup_lng) }, title: "Pickup", label: "A" },
                    { position: { lat: Number(selectedRide.dropoff_lat), lng: Number(selectedRide.dropoff_lng) }, title: "Dropoff", label: "B" },
                  ]}
                  route={{
                    origin: { lat: Number(selectedRide.pickup_lat), lng: Number(selectedRide.pickup_lng) },
                    destination: { lat: Number(selectedRide.dropoff_lat), lng: Number(selectedRide.dropoff_lng) },
                  }}
                  center={{ lat: Number(selectedRide.pickup_lat), lng: Number(selectedRide.pickup_lng) }}
                  zoom={13}
                />
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground">Status</p><Badge className="capitalize mt-1">{selectedRide.status.replace("_", " ")}</Badge></div>
                <div><p className="text-muted-foreground">Fare</p><p className="font-bold">R{(selectedRide.actual_fare || selectedRide.estimated_fare || 0).toFixed(2)}</p></div>
                <div><p className="text-muted-foreground">Distance</p><p className="font-medium">{selectedRide.estimated_distance_km?.toFixed(1) || "—"} km</p></div>
                <div><p className="text-muted-foreground">Duration</p><p className="font-medium">{selectedRide.estimated_duration_minutes || "—"} min</p></div>
              </div>

              <div className="space-y-2 text-sm">
                <div><p className="text-muted-foreground">Pickup</p><p className="font-medium">{selectedRide.pickup_address}</p></div>
                <div><p className="text-muted-foreground">Drop-off</p><p className="font-medium">{selectedRide.dropoff_address}</p></div>
              </div>

              <div className="text-xs text-muted-foreground">
                Created: {format(new Date(selectedRide.created_at), "PPpp")}
                {selectedRide.completed_at && <> · Completed: {format(new Date(selectedRide.completed_at), "PPpp")}</>}
              </div>

              {!["completed", "cancelled", "no_drivers"].includes(selectedRide.status) && (
                <Button variant="destructive" className="w-full" onClick={() => handleCancelRide(selectedRide.id)}>
                  <AlertTriangle className="h-4 w-4 mr-2" />Admin Cancel Ride
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRideMonitoring;
