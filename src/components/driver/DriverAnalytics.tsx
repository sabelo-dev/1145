import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Driver, DriverAnalytics as DriverAnalyticsType } from "@/types/driver";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import {
  Package,
  DollarSign,
  MapPin,
  Clock,
  TrendingUp,
  TrendingDown,
  RefreshCw,
} from "lucide-react";

interface DriverAnalyticsProps {
  driver: Driver;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

const DriverAnalytics: React.FC<DriverAnalyticsProps> = ({ driver }) => {
  const [weeklyData, setWeeklyData] = useState<DriverAnalyticsType[]>([]);
  const [monthlyData, setMonthlyData] = useState<DriverAnalyticsType[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"week" | "month">("week");

  useEffect(() => {
    fetchAnalytics();
  }, [driver.id]);

  const fetchAnalytics = async () => {
    try {
      const weekStart = format(subDays(new Date(), 7), "yyyy-MM-dd");
      const monthStart = format(subDays(new Date(), 30), "yyyy-MM-dd");
      const today = format(new Date(), "yyyy-MM-dd");

      // Fetch weekly data
      const { data: weekly } = await supabase
        .from("driver_analytics")
        .select("*")
        .eq("driver_id", driver.id)
        .gte("date", weekStart)
        .lte("date", today)
        .order("date", { ascending: true });

      // Fetch monthly data
      const { data: monthly } = await supabase
        .from("driver_analytics")
        .select("*")
        .eq("driver_id", driver.id)
        .gte("date", monthStart)
        .lte("date", today)
        .order("date", { ascending: true });

      setWeeklyData((weekly as unknown as DriverAnalyticsType[]) || []);
      setMonthlyData((monthly as unknown as DriverAnalyticsType[]) || []);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const data = period === "week" ? weeklyData : monthlyData;

  const totalDeliveries = data.reduce((sum, d) => sum + d.deliveries_completed, 0);
  const totalEarnings = data.reduce((sum, d) => sum + Number(d.total_earnings), 0);
  const totalDistance = data.reduce((sum, d) => sum + Number(d.total_distance_km), 0);
  const avgDeliveryTime =
    data.length > 0
      ? Math.round(data.reduce((sum, d) => sum + d.average_delivery_time_mins, 0) / data.length)
      : 0;

  // Prepare chart data with proper date formatting
  const chartData = data.map((d) => ({
    date: format(new Date(d.date), "MMM d"),
    deliveries: d.deliveries_completed,
    earnings: Number(d.total_earnings),
    distance: Number(d.total_distance_km),
  }));

  // Fill in missing days with zeros
  const dateRange = eachDayOfInterval({
    start: subDays(new Date(), period === "week" ? 7 : 30),
    end: new Date(),
  });

  const filledChartData = dateRange.map((date) => {
    const dateStr = format(date, "MMM d");
    const existing = chartData.find((d) => d.date === dateStr);
    return existing || { date: dateStr, deliveries: 0, earnings: 0, distance: 0 };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Performance Analytics</h2>
          <p className="text-muted-foreground">Track your delivery performance</p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as "week" | "month")}>
          <TabsList>
            <TabsTrigger value="week">7 Days</TabsTrigger>
            <TabsTrigger value="month">30 Days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deliveries</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDeliveries}</div>
            <p className="text-xs text-muted-foreground">
              {period === "week" ? "Last 7 days" : "Last 30 days"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalEarnings)}</div>
            <p className="text-xs text-muted-foreground">
              Avg {formatCurrency(totalDeliveries > 0 ? totalEarnings / totalDeliveries : 0)}/delivery
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Distance Covered</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDistance.toFixed(1)} km</div>
            <p className="text-xs text-muted-foreground">
              Avg {totalDeliveries > 0 ? (totalDistance / totalDeliveries).toFixed(1) : 0} km/delivery
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Delivery Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgDeliveryTime} min</div>
            <p className="text-xs text-muted-foreground">Per delivery average</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Deliveries Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Deliveries Over Time</CardTitle>
            <CardDescription>Number of completed deliveries per day</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filledChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar
                    dataKey="deliveries"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Earnings Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Earnings Over Time</CardTitle>
            <CardDescription>Daily earnings in ZAR</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filledChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `R${value}`}
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), "Earnings"]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="earnings"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))", strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Distance Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Distance Covered</CardTitle>
          <CardDescription>Kilometers traveled per day</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filledChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}km`}
                  className="text-muted-foreground"
                />
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(1)} km`, "Distance"]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="distance"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--chart-2))", strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DriverAnalytics;
