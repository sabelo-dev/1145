import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Package, Plus, DollarSign, TrendingUp, Eye, FileText, Users,
  Wrench, CheckCircle, Clock, Loader2, BarChart3,
} from "lucide-react";
import type { LeaseableAsset, LeaseContract, LeaseApplication } from "@/types/leasing";

const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "approved": case "active": return "default";
    case "pending": case "under_review": case "completed": case "leased": return "secondary";
    case "rejected": case "terminated": case "defaulted": return "destructive";
    default: return "outline";
  }
};

const MerchantLeases = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [assets, setAssets] = useState<LeaseableAsset[]>([]);
  const [contracts, setContracts] = useState<LeaseContract[]>([]);
  const [applications, setApplications] = useState<LeaseApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [addAssetOpen, setAddAssetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [newAsset, setNewAsset] = useState({
    title: "", description: "", category: "general", lease_price_monthly: 0,
    security_deposit: 0, condition: "new" as const, min_lease_duration_months: 1, max_lease_duration_months: 24,
  });

  const fetchVendor = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase.from("vendors").select("id").eq("user_id", user.id).maybeSingle();
    if (data) setVendorId(data.id);
  }, [user?.id]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    // Fetch all assets (merchant as provider)
    const [assetsRes, contractsRes, appsRes] = await Promise.all([
      supabase.from("leaseable_assets").select("*").order("created_at", { ascending: false }),
      supabase.from("lease_contracts").select("*").order("created_at", { ascending: false }),
      supabase.from("lease_applications").select("*").order("created_at", { ascending: false }),
    ]);

    if (assetsRes.data) setAssets(assetsRes.data as any);
    if (contractsRes.data) {
      const userIds = [...new Set(contractsRes.data.map((c: any) => c.user_id))];
      const profilesRes = userIds.length ? await supabase.from("profiles").select("id, name, email").in("id", userIds) : { data: [] };
      const profilesMap = Object.fromEntries((profilesRes.data || []).map((p: any) => [p.id, p]));
      setContracts(contractsRes.data.map((c: any) => ({ ...c, user_profile: profilesMap[c.user_id] })) as any);
    }
    if (appsRes.data) {
      const userIds = [...new Set(appsRes.data.map((a: any) => a.user_id))];
      const profilesRes = userIds.length ? await supabase.from("profiles").select("id, name, email").in("id", userIds) : { data: [] };
      const profilesMap = Object.fromEntries((profilesRes.data || []).map((p: any) => [p.id, p]));
      setApplications(appsRes.data.map((a: any) => ({ ...a, applicant_profile: profilesMap[a.user_id] })) as any);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchVendor(); fetchData(); }, [fetchVendor, fetchData]);

  const handleAddAsset = async () => {
    setSaving(true);
    const { error } = await supabase.from("leaseable_assets").insert({
      ...newAsset,
      provider_id: vendorId,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Asset listed for lease!" });
      setAddAssetOpen(false);
      setNewAsset({ title: "", description: "", category: "general", lease_price_monthly: 0, security_deposit: 0, condition: "new", min_lease_duration_months: 1, max_lease_duration_months: 24 });
      fetchData();
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const activeContracts = contracts.filter(c => c.status === "active");
  const totalRevenue = contracts.reduce((sum, c) => sum + (c.total_paid || 0), 0);
  const pendingApps = applications.filter(a => a.status === "pending");

  const statCards = [
    { label: "Listed Assets", value: assets.length, icon: Package, color: "text-primary", bg: "bg-primary/10" },
    { label: "Active Leases", value: activeContracts.length, icon: Users, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { label: "Lease Revenue", value: `R${totalRevenue.toLocaleString()}`, icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-500/10" },
    { label: "Pending Apps", value: pendingApps.length, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
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

      <div className="flex justify-end">
        <Button onClick={() => setAddAssetOpen(true)} className="rounded-xl"><Plus className="h-4 w-4 mr-2" />List Asset for Lease</Button>
      </div>

      <Tabs defaultValue="assets">
        <TabsList className="rounded-xl">
          <TabsTrigger value="assets" className="rounded-lg">My Assets ({assets.length})</TabsTrigger>
          <TabsTrigger value="applications" className="rounded-lg">Applications ({applications.length})</TabsTrigger>
          <TabsTrigger value="contracts" className="rounded-lg">Contracts ({contracts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="assets">
          <Card className="border-0 ring-1 ring-border">
            <CardContent className="p-0">
              {assets.length === 0 ? (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-muted mb-4"><Package className="h-8 w-8 text-muted-foreground" /></div>
                  <h3 className="font-semibold text-lg mb-1">No Lease Assets</h3>
                  <p className="text-sm text-muted-foreground mb-4">List your first asset to start earning lease income.</p>
                  <Button onClick={() => setAddAssetOpen(true)} className="rounded-xl"><Plus className="h-4 w-4 mr-2" />Add Asset</Button>
                </div>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Title</TableHead><TableHead>Category</TableHead><TableHead>Monthly</TableHead>
                    <TableHead>Deposit</TableHead><TableHead>Condition</TableHead><TableHead>Status</TableHead><TableHead>Leases</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {assets.map((asset) => (
                      <TableRow key={asset.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">{asset.title}</TableCell>
                        <TableCell className="capitalize">{asset.category}</TableCell>
                        <TableCell className="font-mono">R{asset.lease_price_monthly.toLocaleString()}</TableCell>
                        <TableCell className="font-mono">R{asset.security_deposit.toLocaleString()}</TableCell>
                        <TableCell><Badge variant="outline" className="rounded-full capitalize">{asset.condition.replace("_", " ")}</Badge></TableCell>
                        <TableCell><Badge variant={statusVariant(asset.status)} className="rounded-full capitalize">{asset.status}</Badge></TableCell>
                        <TableCell>{asset.total_leases}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="applications">
          <Card className="border-0 ring-1 ring-border">
            <CardContent className="p-0">
              {applications.length === 0 ? (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-muted mb-4"><FileText className="h-8 w-8 text-muted-foreground" /></div>
                  <h3 className="font-semibold text-lg mb-1">No Applications</h3>
                  <p className="text-sm text-muted-foreground">Lease applications for your assets will appear here.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Applicant</TableHead><TableHead>Duration</TableHead><TableHead>Monthly</TableHead>
                    <TableHead>Status</TableHead><TableHead>Date</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {applications.map((app) => (
                      <TableRow key={app.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">{app.applicant_profile?.name || app.applicant_name || "Unknown"}</TableCell>
                        <TableCell>{app.lease_duration_months} mo</TableCell>
                        <TableCell className="font-mono">R{app.monthly_payment.toLocaleString()}</TableCell>
                        <TableCell><Badge variant={statusVariant(app.status)} className="rounded-full capitalize">{app.status}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(app.created_at).toLocaleDateString()}</TableCell>
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
              {contracts.length === 0 ? (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-muted mb-4"><Users className="h-8 w-8 text-muted-foreground" /></div>
                  <h3 className="font-semibold text-lg mb-1">No Contracts</h3>
                  <p className="text-sm text-muted-foreground">Active lease contracts will appear here.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Contract #</TableHead><TableHead>Lessee</TableHead><TableHead>Monthly</TableHead>
                    <TableHead>Paid / Due</TableHead><TableHead>Status</TableHead><TableHead>Late</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {contracts.map((contract) => (
                      <TableRow key={contract.id} className="hover:bg-muted/30">
                        <TableCell className="font-mono text-sm">{contract.contract_number}</TableCell>
                        <TableCell className="font-medium">{contract.user_profile?.name || "Unknown"}</TableCell>
                        <TableCell className="font-mono">R{contract.monthly_payment.toLocaleString()}</TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">R{(contract.total_paid || 0).toLocaleString()}</span>
                          <span className="text-muted-foreground text-xs"> / R{(contract.total_due || 0).toLocaleString()}</span>
                        </TableCell>
                        <TableCell><Badge variant={statusVariant(contract.status)} className="rounded-full capitalize">{contract.status}</Badge></TableCell>
                        <TableCell>
                          {contract.late_payments > 0 ? (
                            <Badge variant="destructive" className="rounded-full">{contract.late_payments}</Badge>
                          ) : (
                            <Badge variant="outline" className="rounded-full text-emerald-600">0</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Asset Dialog */}
      <Dialog open={addAssetOpen} onOpenChange={setAddAssetOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>List Asset for Lease</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={newAsset.title} onChange={(e) => setNewAsset({ ...newAsset, title: e.target.value })} className="rounded-xl" placeholder="e.g., MacBook Pro 16-inch" /></div>
            <div><Label>Description</Label><Textarea value={newAsset.description} onChange={(e) => setNewAsset({ ...newAsset, description: e.target.value })} className="rounded-xl" placeholder="Describe the asset..." /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Category</Label><Input value={newAsset.category} onChange={(e) => setNewAsset({ ...newAsset, category: e.target.value })} className="rounded-xl" /></div>
              <div><Label>Condition</Label>
                <Select value={newAsset.condition} onValueChange={(v: any) => setNewAsset({ ...newAsset, condition: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem><SelectItem value="like_new">Like New</SelectItem>
                    <SelectItem value="good">Good</SelectItem><SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="refurbished">Refurbished</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Monthly Price (R)</Label><Input type="number" value={newAsset.lease_price_monthly} onChange={(e) => setNewAsset({ ...newAsset, lease_price_monthly: Number(e.target.value) })} className="rounded-xl" /></div>
              <div><Label>Security Deposit (R)</Label><Input type="number" value={newAsset.security_deposit} onChange={(e) => setNewAsset({ ...newAsset, security_deposit: Number(e.target.value) })} className="rounded-xl" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Min Duration (months)</Label><Input type="number" value={newAsset.min_lease_duration_months} onChange={(e) => setNewAsset({ ...newAsset, min_lease_duration_months: Number(e.target.value) })} className="rounded-xl" /></div>
              <div><Label>Max Duration (months)</Label><Input type="number" value={newAsset.max_lease_duration_months} onChange={(e) => setNewAsset({ ...newAsset, max_lease_duration_months: Number(e.target.value) })} className="rounded-xl" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddAssetOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleAddAsset} disabled={!newAsset.title || saving} className="rounded-xl">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}List Asset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MerchantLeases;
