import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { format, subDays } from "date-fns";
import {
  TrendingUp,
  DollarSign,
  Package,
  Clock,
  MapPin,
} from "lucide-react";

interface Driver {
  id: string;
  name: string;
  total_deliveries: number;
}

interface DriverAnalyticsProps {
  driver: Driver | null;
}

interface DailyStats {
  date: string;
  deliveries: number;
  earnings: number;
  distance: number;
}

const DriverAnalytics: React.FC<DriverAnalyticsProps> = ({ driver }) => {
  const [weeklyData, setWeeklyData] = useState<DailyStats[]>([]);
  const [totals, setTotals] = useState({
    deliveries: 0,
    earnings: 0,
    distance: 0,
    avgTime: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (driver) {
      fetchAnalytics();
    }
  }, [driver]);

  const fetchAnalytics = async () => {
    if (!driver) return;

    setLoading(true);

    // Fetch last 7 days of data
    const startDate = format(subDays(new Date(), 6), "yyyy-MM-dd");
    
    const { data } = await supabase
      .from("driver_analytics")
      .select("*")
      .eq("driver_id", driver.id)
      .gte("date", startDate)
      .order("date", { ascending: true });

    if (data) {
      // Create array for all 7 days
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = format(subDays(new Date(), 6 - i), "yyyy-MM-dd");
        const dayData = data.find((d) => d.date === date);
        return {
          date: format(new Date(date), "EEE"),
          deliveries: dayData?.deliveries_completed || 0,
          earnings: dayData?.total_earnings || 0,
          distance: dayData?.total_distance_km || 0,
        };
      });

      setWeeklyData(last7Days);

      // Calculate totals
      const totalDeliveries = data.reduce((sum, d) => sum + (d.deliveries_completed || 0), 0);
      const totalEarnings = data.reduce((sum, d) => sum + (d.total_earnings || 0), 0);
      const totalDistance = data.reduce((sum, d) => sum + (d.total_distance_km || 0), 0);
      const avgTime = data.length > 0
        ? data.reduce((sum, d) => sum + (d.average_delivery_time_mins || 0), 0) / data.length
        : 0;

      setTotals({
        deliveries: totalDeliveries,
        earnings: totalEarnings,
        distance: totalDistance,
        avgTime: Math.round(avgTime),
      });
    }

    setLoading(false);
  };

  if (!driver) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Performance Analytics</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Deliveries</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.deliveries}</div>
            <p className="text-xs text-muted-foreground">
              {driver.total_deliveries} all time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R{totals.earnings.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Distance Covered</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.distance.toFixed(1)} km</div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Delivery Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.avgTime} min</div>
            <p className="text-xs text-muted-foreground">Per delivery</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Deliveries This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="deliveries" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Earnings This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => `R${Number(value).toFixed(2)}`} />
                  <Line
                    type="monotone"
                    dataKey="earnings"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DriverAnalytics;