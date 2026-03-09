import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Truck, TrendingUp, DollarSign, Clock, Package, Route,
  ArrowUpRight, CheckCircle, XCircle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { format, subDays } from "date-fns";

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

const MerchantRideAnalytics: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalDeliveries: 0, completedDeliveries: 0, avgDeliveryTime: 0,
    totalShippingCost: 0, onTimeRate: 0,
  });
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [statusDist, setStatusDist] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Get vendor's store to find delivery jobs
    const { data: vendor } = await supabase
      .from("vendors")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!vendor) {
      setLoading(false);
      return;
    }

    const { data: deliveryJobs } = await supabase
      .from("delivery_jobs")
      .select("*")
      .eq("vendor_id", vendor.id)
      .order("created_at", { ascending: false });

    if (deliveryJobs) {
      setJobs(deliveryJobs);
      const completed = deliveryJobs.filter((j) => j.status === "delivered");
      const totalCost = deliveryJobs.reduce((s, j) => s + (j.delivery_fee || 0), 0);

      setStats({
        totalDeliveries: deliveryJobs.length,
        completedDeliveries: completed.length,
        avgDeliveryTime: 0,
        totalShippingCost: totalCost,
        onTimeRate: deliveryJobs.length ? (completed.length / deliveryJobs.length) * 100 : 0,
      });

      // Daily deliveries last 7 days
      const days: any[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dayStr = format(date, "yyyy-MM-dd");
        const dayJobs = deliveryJobs.filter((j) => j.created_at?.startsWith(dayStr));
        days.push({
          date: format(date, "EEE"),
          deliveries: dayJobs.length,
          completed: dayJobs.filter((j) => j.status === "delivered").length,
        });
      }
      setDailyData(days);

      // Status distribution
      const statusMap: Record<string, number> = {};
      deliveryJobs.forEach((j) => {
        statusMap[j.status] = (statusMap[j.status] || 0) + 1;
      });
      setStatusDist(Object.entries(statusMap).map(([name, value]) => ({ name, value })));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  const statCards = [
    { label: "Total Deliveries", value: stats.totalDeliveries.toString(), icon: Truck, color: "text-primary", bg: "bg-primary/10" },
    { label: "Completed", value: stats.completedDeliveries.toString(), icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { label: "Shipping Cost", value: `R${stats.totalShippingCost.toFixed(2)}`, icon: DollarSign, color: "text-amber-600", bg: "bg-amber-500/10" },
    { label: "Completion Rate", value: `${stats.onTimeRate.toFixed(0)}%`, icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-500/10" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        {/* Daily Deliveries Chart */}
        <Card className="border-0 ring-1 ring-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Weekly Delivery Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))" }} className="text-xs" />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} className="text-xs" />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                <Bar dataKey="deliveries" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name="Total" />
                <Bar dataKey="completed" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} name="Completed" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card className="border-0 ring-1 ring-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Delivery Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            {statusDist.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={statusDist} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {statusDist.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-16">No delivery data yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Deliveries */}
      <Card className="border-0 ring-1 ring-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Recent Deliveries</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="text-center py-12">
              <Truck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No deliveries yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.slice(0, 10).map((job) => (
                <div key={job.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${job.status === "delivered" ? "bg-emerald-500/10" : "bg-primary/10"}`}>
                    <Package className={`h-4 w-4 ${job.status === "delivered" ? "text-emerald-600" : "text-primary"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">Order #{job.order_id?.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(job.created_at), "PPp")}</p>
                  </div>
                  <Badge variant={job.status === "delivered" ? "secondary" : "outline"} className="rounded-full text-xs capitalize">
                    {job.status}
                  </Badge>
                  {job.delivery_fee && (
                    <span className="text-sm font-semibold">R{job.delivery_fee.toFixed(2)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MerchantRideAnalytics;
