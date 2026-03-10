import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  Car, TrendingUp, DollarSign, Star, Clock, Route,
  ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area,
} from "recharts";
import { format, subDays } from "date-fns";

interface Driver {
  id: string;
  name: string;
  status: string;
}

interface DriverRideAnalyticsProps {
  driver: Driver | null;
}

const DriverRideAnalytics: React.FC<DriverRideAnalyticsProps> = ({ driver }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRides: 0, totalEarnings: 0, avgRating: 0, avgFare: 0,
    completionRate: 0, cancelRate: 0,
  });
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [hourlyData, setHourlyData] = useState<any[]>([]);

  const fetchAnalytics = useCallback(async () => {
    if (!driver) return;
    setLoading(true);

    const { data: rides } = await supabase
      .from("rides")
      .select("*")
      .eq("driver_id", driver.id)
      .order("created_at", { ascending: false });

    if (rides) {
      const completed = rides.filter((r) => r.status === "completed");
      const cancelled = rides.filter((r) => r.status === "cancelled");
      const totalEarnings = completed.reduce((s, r) => s + (r.actual_fare || r.estimated_fare || 0), 0);
      const ratings = completed.filter((r) => r.rating_by_passenger).map((r) => r.rating_by_passenger as number);

      setStats({
        totalRides: completed.length,
        totalEarnings,
        avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
        avgFare: completed.length ? totalEarnings / completed.length : 0,
        completionRate: rides.length ? (completed.length / rides.length) * 100 : 0,
        cancelRate: rides.length ? (cancelled.length / rides.length) * 100 : 0,
      });

      // Weekly data (last 7 days)
      const days: any[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dayStr = format(date, "yyyy-MM-dd");
        const dayRides = rides.filter((r) => r.created_at?.startsWith(dayStr));
        const dayCompleted = dayRides.filter((r) => r.status === "completed");
        const earnings = dayCompleted.reduce((s, r) => s + (r.actual_fare || r.estimated_fare || 0), 0);
        days.push({
          date: format(date, "EEE"),
          rides: dayCompleted.length,
          earnings,
        });
      }
      setWeeklyData(days);

      // Hourly pattern
      const hours: number[] = new Array(24).fill(0);
      completed.forEach((r) => {
        const h = new Date(r.created_at).getHours();
        hours[h]++;
      });
      setHourlyData(hours.map((count, hour) => ({ hour: `${hour}:00`, rides: count })));
    }
    setLoading(false);
  }, [driver]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  const statCards = [
    { label: "Total Rides", value: stats.totalRides.toString(), icon: Car, color: "text-primary", bg: "bg-primary/10" },
    { label: "Total Earnings", value: `R${stats.totalEarnings.toFixed(2)}`, icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { label: "Avg Rating", value: stats.avgRating ? stats.avgRating.toFixed(1) : "N/A", icon: Star, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Avg Fare", value: `R${stats.avgFare.toFixed(2)}`, icon: Route, color: "text-blue-600", bg: "bg-blue-500/10" },
    { label: "Completion Rate", value: `${stats.completionRate.toFixed(0)}%`, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { label: "Cancel Rate", value: `${stats.cancelRate.toFixed(0)}%`, icon: Clock, color: "text-destructive", bg: "bg-destructive/10" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Earnings */}
        <Card className="border-0 ring-1 ring-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Weekly Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))" }} className="text-xs" />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} className="text-xs" />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                <Area type="monotone" dataKey="earnings" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.1} strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Weekly Rides */}
        <Card className="border-0 ring-1 ring-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Weekly Ride Count</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))" }} className="text-xs" />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} className="text-xs" />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                <Bar dataKey="rides" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Peak Hours */}
      <Card className="border-0 ring-1 ring-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Your Peak Hours</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="hour" tick={{ fill: "hsl(var(--muted-foreground))" }} className="text-xs" interval={2} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} className="text-xs" />
              <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
              <Bar dataKey="rides" fill="hsl(var(--chart-3))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default DriverRideAnalytics;
