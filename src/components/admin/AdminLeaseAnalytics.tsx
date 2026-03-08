import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, DollarSign, AlertTriangle, Percent } from "lucide-react";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#f59e0b", "#ef4444", "#8b5cf6"];

const AdminLeaseAnalytics = () => {
  const [contracts, setContracts] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [contractsRes, paymentsRes, assetsRes] = await Promise.all([
      supabase.from("lease_contracts").select("*"),
      supabase.from("lease_payments").select("*"),
      supabase.from("leaseable_assets").select("*"),
    ]);
    if (contractsRes.data) setContracts(contractsRes.data);
    if (paymentsRes.data) setPayments(paymentsRes.data);
    if (assetsRes.data) setAssets(assetsRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-80 rounded-xl" />)}</div>
      </div>
    );
  }

  const totalLeaseRevenue = payments.filter(p => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);
  const overduePayments = payments.filter(p => p.status === "overdue");
  const activeContracts = contracts.filter(c => c.status === "active");
  const defaultedContracts = contracts.filter(c => c.status === "defaulted");
  const utilizationRate = assets.length > 0 ? ((assets.filter(a => a.status === "leased").length / assets.length) * 100).toFixed(1) : "0";

  const assetUtilization = [
    { name: "Available", value: assets.filter(a => a.status === "active").length },
    { name: "Leased", value: assets.filter(a => a.status === "leased").length },
    { name: "Maintenance", value: assets.filter(a => a.status === "maintenance").length },
    { name: "Retired", value: assets.filter(a => a.status === "retired").length },
  ].filter(d => d.value > 0);

  const monthlyRevenue = payments.length > 0
    ? Object.entries(
        payments.filter(p => p.status === "paid").reduce((acc: Record<string, number>, p) => {
          const month = new Date(p.paid_at || p.created_at).toLocaleDateString("en-ZA", { year: "numeric", month: "short" });
          acc[month] = (acc[month] || 0) + p.amount;
          return acc;
        }, {})
      ).map(([month, total]) => ({ month, total }))
    : [{ month: "No data", total: 0 }];

  const statCards = [
    { label: "Lease Revenue", value: `R${totalLeaseRevenue.toLocaleString()}`, icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { label: "Overdue Payments", value: overduePayments.length, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Asset Utilization", value: `${utilizationRate}%`, icon: Percent, color: "text-blue-600", bg: "bg-blue-500/10" },
    { label: "Defaulted", value: defaultedContracts.length, icon: TrendingUp, color: "text-amber-500", bg: "bg-amber-500/10" },
  ];

  const paymentHealth = [
    { label: "Paid", count: payments.filter(p => p.status === "paid").length, variant: "default" as const },
    { label: "Pending", count: payments.filter(p => p.status === "pending").length, variant: "secondary" as const },
    { label: "Overdue", count: overduePayments.length, variant: "destructive" as const },
    { label: "Failed", count: payments.filter(p => p.status === "failed").length, variant: "outline" as const },
    { label: "Refunded", count: payments.filter(p => p.status === "refunded").length, variant: "outline" as const },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Card key={s.label} className="border-0 ring-1 ring-border">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{s.label}</p>
                  <p className="text-2xl font-black mt-1.5 tracking-tight">{s.value}</p>
                </div>
                <div className={`p-2.5 rounded-xl ${s.bg}`}><s.icon className={`h-5 w-5 ${s.color}`} /></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 ring-1 ring-border">
          <CardHeader><CardTitle className="text-base font-semibold">Monthly Revenue</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(val: number) => `R${val.toLocaleString()}`} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 ring-1 ring-border">
          <CardHeader><CardTitle className="text-base font-semibold">Asset Utilization</CardTitle></CardHeader>
          <CardContent>
            {assetUtilization.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">No asset data.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={assetUtilization} cx="50%" cy="50%" outerRadius={100} innerRadius={60} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {assetUtilization.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 ring-1 ring-border lg:col-span-2">
          <CardHeader><CardTitle className="text-base font-semibold">Payment Health</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {paymentHealth.map((p) => (
                <div key={p.label} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-muted/30">
                  <Badge variant={p.variant} className="rounded-full text-lg px-4 py-1 font-bold">{p.count}</Badge>
                  <span className="text-xs font-medium text-muted-foreground">{p.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminLeaseAnalytics;
