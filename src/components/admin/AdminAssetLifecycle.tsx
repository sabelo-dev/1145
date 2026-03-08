import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Package, Wrench, Plus, RotateCcw, Trash2, Settings2, Loader2 } from "lucide-react";
import type { LeaseableAsset, AssetMaintenance } from "@/types/leasing";

const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "active": return "default";
    case "leased": return "secondary";
    case "maintenance": case "pending_approval": return "outline";
    case "retired": return "destructive";
    default: return "outline";
  }
};

const AdminAssetLifecycle = () => {
  const { toast } = useToast();
  const [assets, setAssets] = useState<LeaseableAsset[]>([]);
  const [maintenance, setMaintenance] = useState<AssetMaintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [addAssetOpen, setAddAssetOpen] = useState(false);
  const [addMaintenanceOpen, setAddMaintenanceOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newAsset, setNewAsset] = useState({ title: "", description: "", category: "general", lease_price_monthly: 0, security_deposit: 0, condition: "new" as const });
  const [newMaintenance, setNewMaintenance] = useState({ asset_id: "", maintenance_type: "routine" as const, description: "", scheduled_date: "", cost: 0 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [assetsRes, maintenanceRes] = await Promise.all([
      supabase.from("leaseable_assets").select("*").order("created_at", { ascending: false }),
      supabase.from("asset_maintenance").select("*").order("scheduled_date", { ascending: true }),
    ]);
    if (assetsRes.data) setAssets(assetsRes.data as any);
    if (maintenanceRes.data) setMaintenance(maintenanceRes.data as any);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddAsset = async () => {
    setSaving(true);
    const { error } = await supabase.from("leaseable_assets").insert(newAsset);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setSaving(false); return; }
    toast({ title: "Asset added" });
    setAddAssetOpen(false);
    setNewAsset({ title: "", description: "", category: "general", lease_price_monthly: 0, security_deposit: 0, condition: "new" });
    setSaving(false);
    fetchData();
  };

  const handleAddMaintenance = async () => {
    setSaving(true);
    const { error } = await supabase.from("asset_maintenance").insert(newMaintenance);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setSaving(false); return; }
    toast({ title: "Maintenance scheduled" });
    setAddMaintenanceOpen(false);
    setSaving(false);
    fetchData();
  };

  const handleUpdateAssetStatus = async (assetId: string, status: string) => {
    await supabase.from("leaseable_assets").update({ status, is_available: status === "active" }).eq("id", assetId);
    toast({ title: "Asset status updated" });
    fetchData();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const statCards = [
    { label: "Total Assets", value: assets.length, icon: Package, color: "text-primary", bg: "bg-primary/10" },
    { label: "Available", value: assets.filter(a => a.status === "active").length, icon: Package, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { label: "Currently Leased", value: assets.filter(a => a.status === "leased").length, icon: Settings2, color: "text-blue-600", bg: "bg-blue-500/10" },
    { label: "Pending Maintenance", value: maintenance.filter(m => m.status === "scheduled").length, icon: Wrench, color: "text-amber-500", bg: "bg-amber-500/10" },
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

      <div className="flex justify-end gap-2">
        <Button onClick={() => setAddMaintenanceOpen(true)} variant="outline" className="rounded-xl"><Wrench className="h-4 w-4 mr-2" />Schedule Maintenance</Button>
        <Button onClick={() => setAddAssetOpen(true)} className="rounded-xl"><Plus className="h-4 w-4 mr-2" />Add Asset</Button>
      </div>

      <Tabs defaultValue="assets">
        <TabsList className="rounded-xl">
          <TabsTrigger value="assets" className="rounded-lg">Assets ({assets.length})</TabsTrigger>
          <TabsTrigger value="maintenance" className="rounded-lg">Maintenance ({maintenance.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="assets">
          <Card className="border-0 ring-1 ring-border">
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Title</TableHead><TableHead>Category</TableHead><TableHead>Monthly</TableHead>
                  <TableHead>Condition</TableHead><TableHead>Status</TableHead><TableHead>Leases</TableHead><TableHead>Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {assets.map((asset) => (
                    <TableRow key={asset.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{asset.title}</TableCell>
                      <TableCell className="capitalize">{asset.category}</TableCell>
                      <TableCell className="font-mono">R{asset.lease_price_monthly.toLocaleString()}</TableCell>
                      <TableCell><Badge variant="outline" className="rounded-full capitalize">{asset.condition.replace("_", " ")}</Badge></TableCell>
                      <TableCell><Badge variant={statusVariant(asset.status)} className="rounded-full capitalize">{asset.status}</Badge></TableCell>
                      <TableCell>{asset.total_leases}</TableCell>
                      <TableCell>
                        <div className="flex gap-1.5">
                          {asset.status === "retired" && <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={() => handleUpdateAssetStatus(asset.id, "active")}><RotateCcw className="h-3.5 w-3.5" /></Button>}
                          {asset.status === "active" && <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={() => handleUpdateAssetStatus(asset.id, "retired")}><Trash2 className="h-3.5 w-3.5" /></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance">
          <Card className="border-0 ring-1 ring-border">
            <CardContent className="p-0">
              {maintenance.length === 0 ? (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-muted mb-4"><Wrench className="h-8 w-8 text-muted-foreground" /></div>
                  <h3 className="font-semibold text-lg mb-1">No Maintenance Records</h3>
                  <p className="text-sm text-muted-foreground">Schedule maintenance for your assets above.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead>Scheduled</TableHead><TableHead>Cost</TableHead><TableHead>Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {maintenance.map((m) => (
                      <TableRow key={m.id} className="hover:bg-muted/30">
                        <TableCell><Badge variant="outline" className="rounded-full capitalize">{m.maintenance_type}</Badge></TableCell>
                        <TableCell>{m.description || "—"}</TableCell>
                        <TableCell className="text-sm">{m.scheduled_date ? new Date(m.scheduled_date).toLocaleDateString() : "—"}</TableCell>
                        <TableCell className="font-mono">R{m.cost.toLocaleString()}</TableCell>
                        <TableCell><Badge variant={m.status === "completed" ? "default" : "secondary"} className="rounded-full capitalize">{m.status}</Badge></TableCell>
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
          <DialogHeader><DialogTitle>Add New Leaseable Asset</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={newAsset.title} onChange={(e) => setNewAsset({ ...newAsset, title: e.target.value })} className="rounded-xl" /></div>
            <div><Label>Description</Label><Textarea value={newAsset.description} onChange={(e) => setNewAsset({ ...newAsset, description: e.target.value })} className="rounded-xl" /></div>
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
              <div><Label>Deposit (R)</Label><Input type="number" value={newAsset.security_deposit} onChange={(e) => setNewAsset({ ...newAsset, security_deposit: Number(e.target.value) })} className="rounded-xl" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddAssetOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleAddAsset} disabled={!newAsset.title || saving} className="rounded-xl">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Add Asset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Maintenance Dialog */}
      <Dialog open={addMaintenanceOpen} onOpenChange={setAddMaintenanceOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Schedule Maintenance</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Asset</Label>
              <Select value={newMaintenance.asset_id} onValueChange={(v) => setNewMaintenance({ ...newMaintenance, asset_id: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select asset" /></SelectTrigger>
                <SelectContent>{assets.map(a => <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Type</Label>
              <Select value={newMaintenance.maintenance_type} onValueChange={(v: any) => setNewMaintenance({ ...newMaintenance, maintenance_type: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine">Routine</SelectItem><SelectItem value="repair">Repair</SelectItem>
                  <SelectItem value="inspection">Inspection</SelectItem><SelectItem value="replacement">Replacement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Textarea value={newMaintenance.description} onChange={(e) => setNewMaintenance({ ...newMaintenance, description: e.target.value })} className="rounded-xl" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Date</Label><Input type="date" value={newMaintenance.scheduled_date} onChange={(e) => setNewMaintenance({ ...newMaintenance, scheduled_date: e.target.value })} className="rounded-xl" /></div>
              <div><Label>Cost (R)</Label><Input type="number" value={newMaintenance.cost} onChange={(e) => setNewMaintenance({ ...newMaintenance, cost: Number(e.target.value) })} className="rounded-xl" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMaintenanceOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleAddMaintenance} disabled={!newMaintenance.asset_id || saving} className="rounded-xl">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAssetLifecycle;
