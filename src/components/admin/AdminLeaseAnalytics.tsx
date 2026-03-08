import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { TrendingUp, DollarSign, AlertTriangle, Percent } from "lucide-react";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#f59e0b", "#ef4444", "#8b5cf6"];

const AdminLeaseAnalytics = () => {
  const [contracts, setContracts] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [contractsRes, paymentsRes, assetsRes] = await Promise.all([
        supabase.from("lease_contracts").select("*"),
        supabase.from("lease_payments").select("*"),
        supabase.from("leaseable_assets").select("*"),
      ]);
      if (contractsRes.data) setContracts(contractsRes.data);
      if (paymentsRes.data) setPayments(paymentsRes.data);
      if (assetsRes.data) setAssets(assetsRes.data);
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" /></div>;

  const totalLeaseRevenue = payments.filter(p => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);
  const overduePayments = payments.filter(p => p.status === "overdue");
  const activeContracts = contracts.filter(c => c.status === "active");
  const defaultedContracts = contracts.filter(c => c.status === "defaulted");
  const utilizationRate = assets.length > 0 ? ((assets.filter(a => a.status === "leased").length / assets.length) * 100).toFixed(1) : "0";

  // Revenue by status pie chart
  const revenueByStatus = [
    { name: "Active", value: activeContracts.reduce((s, c) => s + c.total_paid, 0) },
    { name: "Completed", value: contracts.filter(c => c.status === "completed").reduce((s, c) => s + c.total_paid, 0) },
    { name: "Defaulted", value: defaultedContracts.reduce((s, c) => s + c.total_paid, 0) },
  ].filter(d => d.value > 0);

  // Asset utilization pie chart
  const assetUtilization = [
    { name: "Available", value: assets.filter(a => a.status === "active").length },
    { name: "Leased", value: assets.filter(a => a.status === "leased").length },
    { name: "Maintenance", value: assets.filter(a => a.status === "maintenance").length },
    { name: "Retired", value: assets.filter(a => a.status === "retired").length },
  ].filter(d => d.value > 0);

  // Monthly revenue trend (mock if no data)
  const monthlyRevenue = payments.length > 0
    ? Object.entries(
        payments.filter(p => p.status === "paid").reduce((acc: Record<string, number>, p) => {
          const month = new Date(p.paid_at || p.created_at).toLocaleDateString("en-ZA", { year: "numeric", month: "short" });
          acc[month] = (acc[month] || 0) + p.amount;
          return acc;
        }, {})
      ).map(([month, total]) => ({ month, total }))
    : [{ month: "No data", total: 0 }];

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><DollarSign className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">R{totalLeaseRevenue.toLocaleString()}</p><p className="text-sm text-muted-foreground">Total Lease Revenue</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><AlertTriangle className="h-8 w-8 text-red-500" /><div><p className="text-2xl font-bold">{overduePayments.length}</p><p className="text-sm text-muted-foreground">Overdue Payments</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Percent className="h-8 w-8 text-blue-500" /><div><p className="text-2xl font-bold">{utilizationRate}%</p><p className="text-sm text-muted-foreground">Asset Utilization</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><TrendingUp className="h-8 w-8 text-purple-500" /><div><p className="text-2xl font-bold">{defaultedContracts.length}</p><p className="text-sm text-muted-foreground">Defaulted Contracts</p></div></div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <Card>
          <CardHeader><CardTitle>Monthly Lease Revenue</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(val: number) => `R${val.toLocaleString()}`} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Asset Utilization */}
        <Card>
          <CardHeader><CardTitle>Asset Utilization</CardTitle></CardHeader>
          <CardContent>
            {assetUtilization.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">No asset data available.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={assetUtilization} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {assetUtilization.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Revenue Distribution */}
        <Card>
          <CardHeader><CardTitle>Revenue by Contract Status</CardTitle></CardHeader>
          <CardContent>
            {revenueByStatus.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">No revenue data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={revenueByStatus} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: R${value.toLocaleString()}`}>
                    {revenueByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(val: number) => `R${val.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Overdue Payments Summary */}
        <Card>
          <CardHeader><CardTitle>Payment Health</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Paid</span>
                <Badge variant="outline" className="bg-green-100 text-green-800">{payments.filter(p => p.status === "paid").length}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Pending</span>
                <Badge variant="outline" className="bg-yellow-100 text-yellow-800">{payments.filter(p => p.status === "pending").length}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Overdue</span>
                <Badge variant="destructive">{overduePayments.length}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Failed</span>
                <Badge variant="outline" className="bg-red-100 text-red-800">{payments.filter(p => p.status === "failed").length}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Refunded</span>
                <Badge variant="outline">{payments.filter(p => p.status === "refunded").length}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminLeaseAnalytics;
