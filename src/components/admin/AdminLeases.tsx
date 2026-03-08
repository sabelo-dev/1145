import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, Eye, FileText, AlertTriangle, DollarSign, Users, TrendingUp, Loader2 } from "lucide-react";
import type { LeaseApplication, LeaseContract } from "@/types/leasing";

const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "approved": case "active": case "renewed": return "default";
    case "pending": case "under_review": case "completed": return "secondary";
    case "rejected": case "terminated": case "defaulted": return "destructive";
    default: return "outline";
  }
};

const AdminLeases = () => {
  const { toast } = useToast();
  const [applications, setApplications] = useState<LeaseApplication[]>([]);
  const [contracts, setContracts] = useState<LeaseContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<LeaseApplication | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [appsRes, contractsRes] = await Promise.all([
        supabase.from("lease_applications").select("*").order("created_at", { ascending: false }),
        supabase.from("lease_contracts").select("*").order("created_at", { ascending: false }),
      ]);

      if (appsRes.data) {
        const assetIds = [...new Set(appsRes.data.map((a: any) => a.asset_id))];
        const userIds = [...new Set(appsRes.data.map((a: any) => a.user_id))];
        const [assetsRes, profilesRes] = await Promise.all([
          assetIds.length ? supabase.from("leaseable_assets").select("id, title, category, lease_price_monthly").in("id", assetIds) : { data: [] },
          userIds.length ? supabase.from("profiles").select("id, name, email").in("id", userIds) : { data: [] },
        ]);
        const assetsMap = Object.fromEntries((assetsRes.data || []).map((a: any) => [a.id, a]));
        const profilesMap = Object.fromEntries((profilesRes.data || []).map((p: any) => [p.id, p]));
        setApplications(appsRes.data.map((a: any) => ({ ...a, asset: assetsMap[a.asset_id], applicant_profile: profilesMap[a.user_id] })));
      }

      if (contractsRes.data) {
        const assetIds = [...new Set(contractsRes.data.map((c: any) => c.asset_id))];
        const userIds = [...new Set(contractsRes.data.map((c: any) => c.user_id))];
        const [assetsRes, profilesRes] = await Promise.all([
          assetIds.length ? supabase.from("leaseable_assets").select("id, title, category").in("id", assetIds) : { data: [] },
          userIds.length ? supabase.from("profiles").select("id, name, email").in("id", userIds) : { data: [] },
        ]);
        const assetsMap = Object.fromEntries((assetsRes.data || []).map((a: any) => [a.id, a]));
        const profilesMap = Object.fromEntries((profilesRes.data || []).map((p: any) => [p.id, p]));
        setContracts(contractsRes.data.map((c: any) => ({ ...c, asset: assetsMap[c.asset_id], user_profile: profilesMap[c.user_id] })));
      }
    } catch (err) {
      console.error("Error fetching lease data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleApprove = async (app: LeaseApplication) => {
    setProcessing(app.id);
    try {
      await supabase.from("lease_applications").update({ status: "approved", reviewed_at: new Date().toISOString() }).eq("id", app.id);
      const contractNumber = `LC-${Date.now().toString(36).toUpperCase()}`;
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + app.lease_duration_months);

      await supabase.from("lease_contracts").insert({
        application_id: app.id, user_id: app.user_id, asset_id: app.asset_id,
        contract_number: contractNumber, start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0], monthly_payment: app.monthly_payment,
        security_deposit: app.security_deposit, total_due: app.monthly_payment * app.lease_duration_months,
        next_payment_date: startDate.toISOString().split("T")[0], payments_remaining: app.lease_duration_months,
      });
      await supabase.from("leaseable_assets").update({ status: "leased", is_available: false }).eq("id", app.asset_id);
      toast({ title: "Lease approved", description: `Contract ${contractNumber} created.` });
      fetchData();
    } catch {
      toast({ title: "Error", description: "Failed to approve lease.", variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!selectedApp) return;
    setProcessing(selectedApp.id);
    try {
      await supabase.from("lease_applications").update({ status: "rejected", rejection_reason: rejectionReason, reviewed_at: new Date().toISOString() }).eq("id", selectedApp.id);
      toast({ title: "Application rejected" });
      setReviewDialogOpen(false);
      setRejectionReason("");
      setSelectedApp(null);
      fetchData();
    } catch {
      toast({ title: "Error", description: "Failed to reject.", variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  };

  const stats = {
    totalApplications: applications.length,
    pending: applications.filter(a => a.status === "pending").length,
    activeContracts: contracts.filter(c => c.status === "active").length,
    totalRevenue: contracts.reduce((sum, c) => sum + (c.total_paid || 0), 0),
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

  const statCards = [
    { label: "Total Applications", value: stats.totalApplications, icon: FileText, color: "text-primary", bg: "bg-primary/10" },
    { label: "Pending Review", value: stats.pending, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Active Leases", value: stats.activeContracts, icon: Users, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { label: "Total Revenue", value: `R${stats.totalRevenue.toLocaleString()}`, icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-500/10" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Card key={s.label} className="border-0 ring-1 ring-border overflow-hidden">
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

      <Tabs defaultValue="applications">
        <TabsList className="rounded-xl">
          <TabsTrigger value="applications" className="rounded-lg">Applications ({applications.length})</TabsTrigger>
          <TabsTrigger value="contracts" className="rounded-lg">Active ({contracts.filter(c => c.status === "active").length})</TabsTrigger>
          <TabsTrigger value="all-contracts" className="rounded-lg">All Contracts ({contracts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="applications">
          <Card className="border-0 ring-1 ring-border">
            <CardContent className="p-0">
              {applications.length === 0 ? (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-muted mb-4"><FileText className="h-8 w-8 text-muted-foreground" /></div>
                  <h3 className="font-semibold text-lg mb-1">No Applications</h3>
                  <p className="text-sm text-muted-foreground">Lease applications will appear here.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Applicant</TableHead><TableHead>Asset</TableHead><TableHead>Duration</TableHead>
                    <TableHead>Monthly</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead>Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {applications.map((app) => (
                      <TableRow key={app.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">{app.applicant_profile?.name || app.applicant_name || "Unknown"}</TableCell>
                        <TableCell>{app.asset?.title || "Unknown"}</TableCell>
                        <TableCell>{app.lease_duration_months} mo</TableCell>
                        <TableCell className="font-mono">R{app.monthly_payment.toLocaleString()}</TableCell>
                        <TableCell><Badge variant={statusVariant(app.status)} className="rounded-full capitalize">{app.status}</Badge></TableCell>
                        <TableCell className="text-muted-foreground text-sm">{new Date(app.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-1.5">
                            {app.status === "pending" && (
                              <>
                                <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={() => handleApprove(app)} disabled={processing === app.id}>
                                  {processing === app.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />}
                                </Button>
                                <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={() => { setSelectedApp(app); setReviewDialogOpen(true); }}>
                                  <XCircle className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </>
                            )}
                            <Button size="sm" variant="ghost" className="h-8 rounded-lg"><Eye className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
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
              {contracts.filter(c => c.status === "active").length === 0 ? (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-muted mb-4"><Users className="h-8 w-8 text-muted-foreground" /></div>
                  <h3 className="font-semibold text-lg mb-1">No Active Contracts</h3>
                  <p className="text-sm text-muted-foreground">Active lease contracts will appear here.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Contract #</TableHead><TableHead>Lessee</TableHead><TableHead>Asset</TableHead>
                    <TableHead>Monthly</TableHead><TableHead>Paid / Due</TableHead><TableHead>Next Payment</TableHead><TableHead>Late</TableHead><TableHead>Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {contracts.filter(c => c.status === "active").map((contract) => (
                      <TableRow key={contract.id} className="hover:bg-muted/30">
                        <TableCell className="font-mono text-sm">{contract.contract_number}</TableCell>
                        <TableCell className="font-medium">{contract.user_profile?.name || "Unknown"}</TableCell>
                        <TableCell>{contract.asset?.title || "Unknown"}</TableCell>
                        <TableCell className="font-mono">R{contract.monthly_payment.toLocaleString()}</TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">R{(contract.total_paid || 0).toLocaleString()}</span>
                          <span className="text-muted-foreground text-xs"> / R{(contract.total_due || 0).toLocaleString()}</span>
                        </TableCell>
                        <TableCell className="text-sm">{contract.next_payment_date ? new Date(contract.next_payment_date).toLocaleDateString() : "—"}</TableCell>
                        <TableCell>
                          {contract.late_payments > 0 ? (
                            <Badge variant="destructive" className="rounded-full">{contract.late_payments}</Badge>
                          ) : (
                            <Badge variant="outline" className="rounded-full text-emerald-600">0</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1.5">
                            <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={() => toast({ title: "Reminder sent", description: `Payment reminder sent for ${contract.contract_number}.` })}>
                              <AlertTriangle className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 rounded-lg"><Eye className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all-contracts">
          <Card className="border-0 ring-1 ring-border">
            <CardContent className="p-0">
              {contracts.length === 0 ? (
                <div className="text-center py-16"><p className="text-muted-foreground">No contracts yet.</p></div>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Contract #</TableHead><TableHead>Lessee</TableHead><TableHead>Asset</TableHead>
                    <TableHead>Status</TableHead><TableHead>Period</TableHead><TableHead>Total Paid</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {contracts.map((contract) => (
                      <TableRow key={contract.id} className="hover:bg-muted/30">
                        <TableCell className="font-mono text-sm">{contract.contract_number}</TableCell>
                        <TableCell className="font-medium">{contract.user_profile?.name || "Unknown"}</TableCell>
                        <TableCell>{contract.asset?.title || "Unknown"}</TableCell>
                        <TableCell><Badge variant={statusVariant(contract.status)} className="rounded-full capitalize">{contract.status}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(contract.start_date).toLocaleDateString()} — {new Date(contract.end_date).toLocaleDateString()}</TableCell>
                        <TableCell className="font-mono">R{(contract.total_paid || 0).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Reject Lease Application</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Provide a reason for rejection:</p>
            <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Reason for rejection..." className="rounded-xl" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)} className="rounded-xl">Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!!processing} className="rounded-xl">
              {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLeases;
