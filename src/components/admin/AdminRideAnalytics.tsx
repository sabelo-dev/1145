import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  Car, TrendingUp, DollarSign, Users, Clock, MapPin, Star, Activity,
  ArrowUpRight, ArrowDownRight, Route,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const AdminRideAnalytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRides: 0, completedRides: 0, cancelledRides: 0, activeRides: 0,
    totalRevenue: 0, avgFare: 0, avgRating: 0, avgWaitTime: 0,
  });
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<any[]>([]);
  const [hourlyData, setHourlyData] = useState<any[]>([]);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rides } = await supabase
        .from("rides")
        .select("*")
        .order("created_at", { ascending: false });

      if (rides) {
        const completed = rides.filter((r) => r.status === "completed");
        const cancelled = rides.filter((r) => r.status === "cancelled");
        const active = rides.filter((r) => !["completed", "cancelled"].includes(r.status));
        const totalRevenue = completed.reduce((s, r) => s + (r.actual_fare || r.estimated_fare || 0), 0);
        const ratings = completed.filter((r) => r.rating_by_passenger).map((r) => r.rating_by_passenger as number);

        setStats({
          totalRides: rides.length,
          completedRides: completed.length,
          cancelledRides: cancelled.length,
          activeRides: active.length,
          totalRevenue,
          avgFare: completed.length ? totalRevenue / completed.length : 0,
          avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
          avgWaitTime: 0,
        });

        // Daily rides for last 14 days
        const days: any[] = [];
        for (let i = 13; i >= 0; i--) {
          const date = subDays(new Date(), i);
          const dayStr = format(date, "yyyy-MM-dd");
          const dayRides = rides.filter((r) => r.created_at?.startsWith(dayStr));
          const dayCompleted = dayRides.filter((r) => r.status === "completed");
          const dayRevenue = dayCompleted.reduce((s, r) => s + (r.actual_fare || r.estimated_fare || 0), 0);
          days.push({
            date: format(date, "MMM dd"),
            rides: dayRides.length,
            completed: dayCompleted.length,
            revenue: dayRevenue,
          });
        }
        setDailyData(days);

        // Status distribution
        const statusMap: Record<string, number> = {};
        rides.forEach((r) => {
          statusMap[r.status] = (statusMap[r.status] || 0) + 1;
        });
        setStatusDistribution(
          Object.entries(statusMap).map(([name, value]) => ({ name, value }))
        );

        // Hourly distribution
        const hours: number[] = new Array(24).fill(0);
        rides.forEach((r) => {
          const h = new Date(r.created_at).getHours();
          hours[h]++;
        });
        setHourlyData(hours.map((count, hour) => ({ hour: `${hour}:00`, rides: count })));
      }
    } catch (err) {
      console.error("Error fetching ride analytics:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  const statCards = [
    { label: "Total Rides", value: stats.totalRides.toString(), icon: Car, color: "text-primary", bg: "bg-primary/10", change: "+12%" },
    { label: "Completed", value: stats.completedRides.toString(), icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-500/10", change: "+8%" },
    { label: "Cancelled", value: stats.cancelledRides.toString(), icon: Activity, color: "text-destructive", bg: "bg-destructive/10", change: "-3%" },
    { label: "Active Now", value: stats.activeRides.toString(), icon: MapPin, color: "text-blue-600", bg: "bg-blue-500/10" },
    { label: "Total Revenue", value: `R${stats.totalRevenue.toFixed(0)}`, icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-500/10", change: "+15%" },
    { label: "Avg Fare", value: `R${stats.avgFare.toFixed(2)}`, icon: Route, color: "text-primary", bg: "bg-primary/10" },
    { label: "Avg Rating", value: stats.avgRating ? stats.avgRating.toFixed(1) : "N/A", icon: Star, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Active Drivers", value: "—", icon: Users, color: "text-blue-600", bg: "bg-blue-500/10" },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="border-0 ring-1 ring-border overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                  <p className="text-2xl font-black mt-1.5 tracking-tight">{stat.value}</p>
                  {stat.change && (
                    <p className={`text-xs mt-1 flex items-center gap-0.5 ${stat.change.startsWith("+") ? "text-emerald-600" : "text-destructive"}`}>
                      {stat.change.startsWith("+") ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {stat.change} vs last period
                    </p>
                  )}
                </div>
                <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 ring-1 ring-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Daily Rides & Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                <Area type="monotone" dataKey="rides" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} strokeWidth={2} />
                <Area type="monotone" dataKey="completed" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 ring-1 ring-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Ride Status Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {statusDistribution.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 ring-1 ring-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Revenue Trend (14 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--chart-2))" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 ring-1 ring-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Hourly Demand Pattern</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="hour" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} interval={2} />
                <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                <Bar dataKey="rides" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminRideAnalytics;
