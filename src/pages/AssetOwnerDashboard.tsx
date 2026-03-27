import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { Package, DollarSign, TrendingUp, Users, Plus, Eye, BarChart3, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const AssetOwnerDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [provider, setProvider] = useState<any>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    // Get provider
    const { data: prov } = await supabase.from("asset_providers").select("*").eq("user_id", user.id).maybeSingle();
    setProvider(prov);

    if (prov) {
      const [assetsRes, contractsRes] = await Promise.all([
        supabase.from("leaseable_assets").select("*").eq("provider_id", prov.id).order("created_at", { ascending: false }),
        supabase.from("lease_contracts").select("*, leaseable_assets(title, category, images)").in("asset_id", 
          (await supabase.from("leaseable_assets").select("id").eq("provider_id", prov.id)).data?.map((a: any) => a.id) || []
        ),
      ]);
      setAssets(assetsRes.data || []);
      setContracts(contractsRes.data || []);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Become an Asset Provider</h1>
        <p className="text-muted-foreground mb-6">List your vehicles, equipment, and assets for leasing on the 1145 marketplace. Earn passive income while your assets work for you.</p>
        <Button size="lg" onClick={async () => {
          await supabase.from("asset_providers").insert({ user_id: user!.id, company_name: 'My Assets', status: 'approved' });
          fetchData();
        }}>
          <Plus className="h-4 w-4 mr-2" />Register as Provider
        </Button>
      </div>
    );
  }

  const totalRevenue = contracts.reduce((s, c) => s + (c.total_paid || 0), 0);
  const activeContracts = contracts.filter(c => c.status === 'active');
  const monthlyIncome = activeContracts.reduce((s, c) => s + c.monthly_payment, 0);
  const activeAssets = assets.filter(a => a.status === 'active');

  const stats = [
    { label: "Total Assets", value: assets.length.toString(), icon: Package, color: "text-primary", bg: "bg-primary/10" },
    { label: "Active Leases", value: activeContracts.length.toString(), icon: Users, color: "text-blue-600", bg: "bg-blue-500/10" },
    { label: "Monthly Income", value: formatCurrency(monthlyIncome), icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { label: "Total Revenue", value: formatCurrency(totalRevenue), icon: TrendingUp, color: "text-amber-600", bg: "bg-amber-500/10" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-2"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
            <h1 className="text-2xl font-black tracking-tight">Asset Owner Dashboard</h1>
            <p className="text-muted-foreground">{provider.company_name}</p>
          </div>
          <Button onClick={() => navigate("/lease/marketplace")}><Plus className="h-4 w-4 mr-2" />List New Asset</Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(s => (
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

        <Tabs defaultValue="assets">
          <TabsList className="rounded-xl">
            <TabsTrigger value="assets" className="rounded-lg">My Assets ({assets.length})</TabsTrigger>
            <TabsTrigger value="contracts" className="rounded-lg">Active Leases ({activeContracts.length})</TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-lg">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="assets">
            <Card className="border-0 ring-1 ring-border">
              <CardContent className="p-0">
                {assets.length === 0 ? (
                  <div className="text-center py-16">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <h3 className="font-semibold">No Assets Listed</h3>
                    <p className="text-sm text-muted-foreground mt-1">Start listing assets to earn passive income.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Asset</TableHead><TableHead>Category</TableHead><TableHead>Monthly Price</TableHead>
                      <TableHead>Status</TableHead><TableHead>Leases</TableHead><TableHead>Views</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {assets.map(asset => (
                        <TableRow key={asset.id} className="hover:bg-muted/30">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {asset.images?.[0] && <img src={asset.images[0]} className="h-10 w-10 rounded-lg object-cover" alt="" />}
                              <div>
                                <p className="font-medium">{asset.title}</p>
                                <p className="text-xs text-muted-foreground">{asset.brand} {asset.model}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="outline" className="capitalize">{asset.category}</Badge></TableCell>
                          <TableCell className="font-mono">{formatCurrency(asset.lease_price_monthly)}</TableCell>
                          <TableCell>
                            <Badge variant={asset.status === 'active' ? 'default' : 'secondary'} className="capitalize rounded-full">{asset.status}</Badge>
                          </TableCell>
                          <TableCell>{asset.total_leases || 0}</TableCell>
                          <TableCell className="flex items-center gap-1"><Eye className="h-3 w-3" />{asset.views_count || 0}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contracts">
            <Card className="border-0 ring-1 ring-border">
              <CardContent className="p-0">
                {activeContracts.length === 0 ? (
                  <div className="text-center py-16"><p className="text-muted-foreground">No active leases.</p></div>
                ) : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Contract #</TableHead><TableHead>Asset</TableHead><TableHead>Monthly</TableHead>
                      <TableHead>Total Paid</TableHead><TableHead>Remaining</TableHead><TableHead>Status</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {activeContracts.map(c => (
                        <TableRow key={c.id}>
                          <TableCell className="font-mono text-sm">{c.contract_number}</TableCell>
                          <TableCell>{(c as any).leaseable_assets?.title || 'Asset'}</TableCell>
                          <TableCell className="font-mono">{formatCurrency(c.monthly_payment)}</TableCell>
                          <TableCell className="font-mono">{formatCurrency(c.total_paid || 0)}</TableCell>
                          <TableCell>{c.payments_remaining || 0} payments</TableCell>
                          <TableCell><Badge className="capitalize rounded-full">{c.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-0 ring-1 ring-border">
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><BarChart3 className="h-5 w-5" />Asset Utilization</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {assets.slice(0, 5).map(a => {
                      const util = a.status === 'leased' ? 100 : a.status === 'active' ? 0 : 50;
                      return (
                        <div key={a.id}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="truncate">{a.title}</span>
                            <span className="text-muted-foreground">{util}%</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${util}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 ring-1 ring-border">
                <CardHeader><CardTitle className="text-lg">Revenue Summary</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Revenue</span><span className="font-bold">{formatCurrency(totalRevenue)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Monthly Income</span><span className="font-bold">{formatCurrency(monthlyIncome)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Active Leases</span><span className="font-bold">{activeContracts.length}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Avg per Asset</span><span className="font-bold">{formatCurrency(assets.length > 0 ? totalRevenue / assets.length : 0)}</span></div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AssetOwnerDashboard;
