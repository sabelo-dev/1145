import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Driver, DeliveryJob, DriverAnalytics } from "@/types/driver";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import {
  Package,
  DollarSign,
  Clock,
  Star,
  TrendingUp,
  MapPin,
  Truck,
} from "lucide-react";

interface DriverOverviewProps {
  driver: Driver;
}

const DriverOverview: React.FC<DriverOverviewProps> = ({ driver }) => {
  const [todayStats, setTodayStats] = useState({
    deliveries: 0,
    earnings: 0,
    distance: 0,
  });
  const [weekStats, setWeekStats] = useState({
    deliveries: 0,
    earnings: 0,
    distance: 0,
  });
  const [activeDelivery, setActiveDelivery] = useState<DeliveryJob | null>(null);
  const [pendingJobs, setPendingJobs] = useState(0);

  useEffect(() => {
    fetchStats();
    fetchActiveDelivery();
    fetchPendingJobs();
  }, [driver.id]);

  const fetchStats = async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const weekStart = format(startOfWeek(new Date()), "yyyy-MM-dd");
    const weekEnd = format(endOfWeek(new Date()), "yyyy-MM-dd");

    // Fetch today's stats
    const { data: todayData } = await supabase
      .from("driver_analytics")
      .select("*")
      .eq("driver_id", driver.id)
      .eq("date", today)
      .maybeSingle();

    if (todayData) {
      setTodayStats({
        deliveries: todayData.deliveries_completed,
        earnings: Number(todayData.total_earnings),
        distance: Number(todayData.total_distance_km),
      });
    }

    // Fetch week stats
    const { data: weekData } = await supabase
      .from("driver_analytics")
      .select("*")
      .eq("driver_id", driver.id)
      .gte("date", weekStart)
      .lte("date", weekEnd);

    if (weekData) {
      const weekTotals = weekData.reduce(
        (acc, day) => ({
          deliveries: acc.deliveries + day.deliveries_completed,
          earnings: acc.earnings + Number(day.total_earnings),
          distance: acc.distance + Number(day.total_distance_km),
        }),
        { deliveries: 0, earnings: 0, distance: 0 }
      );
      setWeekStats(weekTotals);
    }
  };

  const fetchActiveDelivery = async () => {
    const { data } = await supabase
      .from("delivery_jobs")
      .select("*")
      .eq("driver_id", driver.id)
      .in("status", ["accepted", "picked_up", "in_transit"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setActiveDelivery(data as unknown as DeliveryJob);
    }
  };

  const fetchPendingJobs = async () => {
    const { count } = await supabase
      .from("delivery_jobs")
      .select("*", { count: "exact", head: true })
      .is("driver_id", null)
      .eq("status", "pending");

    setPendingJobs(count || 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {driver.name}!</h1>
          <p className="text-muted-foreground">
            Here's what's happening with your deliveries today.
          </p>
        </div>
        <Badge
          variant={driver.status === "available" ? "default" : "secondary"}
          className="text-sm"
        >
          {driver.status === "available" ? "Ready for deliveries" : driver.status}
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Deliveries</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayStats.deliveries}</div>
            <p className="text-xs text-muted-foreground">
              {weekStats.deliveries} this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(todayStats.earnings)}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(weekStats.earnings)} this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Distance Covered</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayStats.distance.toFixed(1)} km</div>
            <p className="text-xs text-muted-foreground">
              {weekStats.distance.toFixed(1)} km this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your Rating</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Number(driver.rating).toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">
              {driver.total_deliveries} total deliveries
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Delivery & Available Jobs */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Active Delivery */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Current Delivery
            </CardTitle>
            <CardDescription>Your active delivery status</CardDescription>
          </CardHeader>
          <CardContent>
            {activeDelivery ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="capitalize">
                    {activeDelivery.status.replace("_", " ")}
                  </Badge>
                  {activeDelivery.earnings && (
                    <span className="font-semibold text-green-600">
                      {formatCurrency(activeDelivery.earnings)}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="mt-1 h-2 w-2 rounded-full bg-green-500" />
                    <div>
                      <p className="text-sm font-medium">Pickup</p>
                      <p className="text-xs text-muted-foreground">
                        {activeDelivery.pickup_address.street}, {activeDelivery.pickup_address.city}
                      </p>
                    </div>
                  </div>
                  <div className="ml-1 border-l-2 border-dashed h-4" />
                  <div className="flex items-start gap-2">
                    <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                    <div>
                      <p className="text-sm font-medium">Delivery</p>
                      <p className="text-xs text-muted-foreground">
                        {activeDelivery.delivery_address.street}, {activeDelivery.delivery_address.city}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Truck className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No active delivery</p>
                <p className="text-sm">Accept a job to get started</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Available Jobs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Available Jobs
            </CardTitle>
            <CardDescription>Jobs waiting to be claimed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <div className="text-4xl font-bold text-primary mb-2">{pendingJobs}</div>
              <p className="text-muted-foreground">
                {pendingJobs === 1 ? "job" : "jobs"} available
              </p>
              {pendingJobs > 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  First come, first served!
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DriverOverview;
