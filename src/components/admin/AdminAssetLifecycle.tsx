import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { useToast } from "@/hooks/use-toast";
import { Package, Wrench, Calendar, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { LeaseableAsset, AssetMaintenance } from "@/types/leasing";

const AdminAssetLifecycle = () => {
  const { toast } = useToast();
  const [assets, setAssets] = useState<LeaseableAsset[]>([]);
  const [maintenance, setMaintenance] = useState<AssetMaintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [addAssetOpen, setAddAssetOpen] = useState(false);
  const [addMaintenanceOpen, setAddMaintenanceOpen] = useState(false);
  const [newAsset, setNewAsset] = useState({ title: "", description: "", category: "general", lease_price_monthly: 0, security_deposit: 0, condition: "new" as const });
  const [newMaintenance, setNewMaintenance] = useState({ asset_id: "", maintenance_type: "routine" as const, description: "", scheduled_date: "", cost: 0 });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [assetsRes, maintenanceRes] = await Promise.all([
      supabase.from("leaseable_assets").select("*").order("created_at", { ascending: false }),
      supabase.from("asset_maintenance").select("*").order("scheduled_date", { ascending: true }),
    ]);
    if (assetsRes.data) setAssets(assetsRes.data as any);
    if (maintenanceRes.data) setMaintenance(maintenanceRes.data as any);
    setLoading(false);
  };

  const handleAddAsset = async () => {
    const { error } = await supabase.from("leaseable_assets").insert(newAsset);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Asset added" });
    setAddAssetOpen(false);
    setNewAsset({ title: "", description: "", category: "general", lease_price_monthly: 0, security_deposit: 0, condition: "new" });
    fetchData();
  };

  const handleAddMaintenance = async () => {
    const { error } = await supabase.from("asset_maintenance").insert(newMaintenance);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Maintenance scheduled" });
    setAddMaintenanceOpen(false);
    fetchData();
  };

  const handleUpdateAssetStatus = async (assetId: string, status: string) => {
    await supabase.from("leaseable_assets").update({ status, is_available: status === "active" }).eq("id", assetId);
    toast({ title: "Asset status updated" });
    fetchData();
  };

  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-800", leased: "bg-blue-100 text-blue-800",
    maintenance: "bg-yellow-100 text-yellow-800", retired: "bg-muted text-muted-foreground",
    pending_approval: "bg-orange-100 text-orange-800",
  };

  if (loading) return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" /></div>;

  const expiringContracts = assets.filter(a => a.status === "leased");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Package className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{assets.length}</p><p className="text-sm text-muted-foreground">Total Assets</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center"><span className="text-green-700 font-bold">{assets.filter(a => a.status === "active").length}</span></div><div><p className="text-sm text-muted-foreground">Available</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center"><span className="text-blue-700 font-bold">{assets.filter(a => a.status === "leased").length}</span></div><div><p className="text-sm text-muted-foreground">Currently Leased</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Wrench className="h-8 w-8 text-yellow-500" /><div><p className="text-2xl font-bold">{maintenance.filter(m => m.status === "scheduled").length}</p><p className="text-sm text-muted-foreground">Pending Maintenance</p></div></div></CardContent></Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button onClick={() => setAddMaintenanceOpen(true)} variant="outline"><Wrench className="h-4 w-4 mr-2" />Schedule Maintenance</Button>
        <Button onClick={() => setAddAssetOpen(true)}><Plus className="h-4 w-4 mr-2" />Add Asset</Button>
      </div>

      <Tabs defaultValue="assets">
        <TabsList>
          <TabsTrigger value="assets">All Assets ({assets.length})</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance ({maintenance.length})</TabsTrigger>
          <TabsTrigger value="expiring">Expiring Contracts ({expiringContracts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="assets">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Monthly Price</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total Leases</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell className="font-medium">{asset.title}</TableCell>
                      <TableCell>{asset.category}</TableCell>
                      <TableCell>R{asset.lease_price_monthly.toLocaleString()}</TableCell>
                      <TableCell className="capitalize">{asset.condition.replace("_", " ")}</TableCell>
                      <TableCell><Badge className={statusColors[asset.status] || ""}>{asset.status}</Badge></TableCell>
                      <TableCell>{asset.total_leases}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {asset.status === "retired" && <Button size="sm" variant="outline" onClick={() => handleUpdateAssetStatus(asset.id, "active")}><RotateCcw className="h-4 w-4" /></Button>}
                          {asset.status === "active" && <Button size="sm" variant="outline" onClick={() => handleUpdateAssetStatus(asset.id, "retired")}><Trash2 className="h-4 w-4" /></Button>}
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
          <Card>
            <CardContent className="pt-6">
              {maintenance.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No maintenance records.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {maintenance.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="capitalize">{m.maintenance_type}</TableCell>
                        <TableCell>{m.description || "-"}</TableCell>
                        <TableCell>{m.scheduled_date ? new Date(m.scheduled_date).toLocaleDateString() : "-"}</TableCell>
                        <TableCell>R{m.cost.toLocaleString()}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{m.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expiring">
          <Card>
            <CardContent className="pt-6">
              {expiringContracts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No expiring contracts.</p>
              ) : (
                <p className="text-muted-foreground text-center py-8">Assets currently leased are shown here for re-lease planning.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Asset Dialog */}
      <Dialog open={addAssetOpen} onOpenChange={setAddAssetOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Leaseable Asset</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={newAsset.title} onChange={(e) => setNewAsset({ ...newAsset, title: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={newAsset.description} onChange={(e) => setNewAsset({ ...newAsset, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Category</Label><Input value={newAsset.category} onChange={(e) => setNewAsset({ ...newAsset, category: e.target.value })} /></div>
              <div><Label>Condition</Label>
                <Select value={newAsset.condition} onValueChange={(v: any) => setNewAsset({ ...newAsset, condition: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="like_new">Like New</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="refurbished">Refurbished</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Monthly Lease Price (R)</Label><Input type="number" value={newAsset.lease_price_monthly} onChange={(e) => setNewAsset({ ...newAsset, lease_price_monthly: Number(e.target.value) })} /></div>
              <div><Label>Security Deposit (R)</Label><Input type="number" value={newAsset.security_deposit} onChange={(e) => setNewAsset({ ...newAsset, security_deposit: Number(e.target.value) })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddAssetOpen(false)}>Cancel</Button>
            <Button onClick={handleAddAsset} disabled={!newAsset.title}>Add Asset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Maintenance Dialog */}
      <Dialog open={addMaintenanceOpen} onOpenChange={setAddMaintenanceOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schedule Maintenance</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Asset</Label>
              <Select value={newMaintenance.asset_id} onValueChange={(v) => setNewMaintenance({ ...newMaintenance, asset_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select asset" /></SelectTrigger>
                <SelectContent>{assets.map(a => <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Type</Label>
              <Select value={newMaintenance.maintenance_type} onValueChange={(v: any) => setNewMaintenance({ ...newMaintenance, maintenance_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine">Routine</SelectItem>
                  <SelectItem value="repair">Repair</SelectItem>
                  <SelectItem value="inspection">Inspection</SelectItem>
                  <SelectItem value="replacement">Replacement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Textarea value={newMaintenance.description} onChange={(e) => setNewMaintenance({ ...newMaintenance, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Scheduled Date</Label><Input type="date" value={newMaintenance.scheduled_date} onChange={(e) => setNewMaintenance({ ...newMaintenance, scheduled_date: e.target.value })} /></div>
              <div><Label>Estimated Cost (R)</Label><Input type="number" value={newMaintenance.cost} onChange={(e) => setNewMaintenance({ ...newMaintenance, cost: Number(e.target.value) })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMaintenanceOpen(false)}>Cancel</Button>
            <Button onClick={handleAddMaintenance} disabled={!newMaintenance.asset_id}>Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAssetLifecycle;
