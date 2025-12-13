import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Truck,
  DollarSign,
  Clock,
  Star,
  MapPin,
  TrendingUp,
  Package,
} from "lucide-react";

interface Driver {
  id: string;
  name: string;
  status: string;
  rating: number;
  total_deliveries: number;
}

interface DriverOverviewProps {
  driver: Driver | null;
  onRefresh: () => void;
}

const DriverOverview: React.FC<DriverOverviewProps> = ({ driver, onRefresh }) => {
  const { user } = useAuth();
  const [todayStats, setTodayStats] = useState({
    deliveries: 0,
    earnings: 0,
    distance: 0,
  });
  const [activeJobs, setActiveJobs] = useState(0);
  const [availableJobs, setAvailableJobs] = useState(0);

  useEffect(() => {
    if (driver) {
      fetchTodayStats();
      fetchJobCounts();
    }
  }, [driver]);

  const fetchTodayStats = async () => {
    if (!driver) return;

    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("driver_analytics")
      .select("*")
      .eq("driver_id", driver.id)
      .eq("date", today)
      .maybeSingle();

    if (data) {
      setTodayStats({
        deliveries: data.deliveries_completed || 0,
        earnings: data.total_earnings || 0,
        distance: data.total_distance_km || 0,
      });
    }
  };

  const fetchJobCounts = async () => {
    if (!driver) return;

    // Fetch active jobs for this driver
    const { count: active } = await supabase
      .from("delivery_jobs")
      .select("*", { count: "exact", head: true })
      .eq("driver_id", driver.id)
      .in("status", ["accepted", "picked_up", "in_transit"]);

    // Fetch available jobs
    const { count: available } = await supabase
      .from("delivery_jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .is("driver_id", null);

    setActiveJobs(active || 0);
    setAvailableJobs(available || 0);
  };

  const toggleStatus = async (newStatus: string) => {
    if (!driver) return;

    await supabase
      .from("drivers")
      .update({ status: newStatus })
      .eq("id", driver.id);

    onRefresh();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-500";
      case "busy":
        return "bg-amber-500";
      case "offline":
        return "bg-gray-500";
      case "pending":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  if (!driver) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading driver information...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-4 h-4 rounded-full ${getStatusColor(driver.status)}`} />
              <div>
                <h3 className="font-semibold">Current Status</h3>
                <p className="text-sm text-muted-foreground capitalize">{driver.status}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {driver.status !== "available" && driver.status !== "pending" && (
                <Button onClick={() => toggleStatus("available")} variant="default">
                  Go Online
                </Button>
              )}
              {driver.status === "available" && (
                <Button onClick={() => toggleStatus("offline")} variant="outline">
                  Go Offline
                </Button>
              )}
            </div>
          </div>
          {driver.status === "pending" && (
            <div className="mt-4 p-3 bg-blue-500/10 rounded-lg">
              <p className="text-sm text-blue-600">
                Your driver account is pending approval. You'll be able to accept deliveries once approved.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Deliveries</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayStats.deliveries}</div>
            <p className="text-xs text-muted-foreground">
              {driver.total_deliveries} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R{todayStats.earnings.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              +{todayStats.distance.toFixed(1)} km driven
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeJobs}</div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Jobs</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{availableJobs}</div>
            <p className="text-xs text-muted-foreground">Ready to claim</p>
          </CardContent>
        </Card>
      </div>

      {/* Rating Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            Your Rating
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold">{driver.rating?.toFixed(1) || "5.0"}</div>
            <div className="flex-1">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-6 w-6 ${
                      star <= Math.round(driver.rating || 5)
                        ? "text-amber-500 fill-amber-500"
                        : "text-gray-300"
                    }`}
                  />
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Based on {driver.total_deliveries} deliveries
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DriverOverview;