import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, Eye, FileText, AlertTriangle, DollarSign, Users } from "lucide-react";
import type { LeaseApplication, LeaseContract } from "@/types/leasing";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  under_review: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-muted text-muted-foreground",
  active: "bg-green-100 text-green-800",
  completed: "bg-blue-100 text-blue-800",
  terminated: "bg-red-100 text-red-800",
  defaulted: "bg-red-200 text-red-900",
  renewed: "bg-purple-100 text-purple-800",
};

const AdminLeases = () => {
  const { toast } = useToast();
  const [applications, setApplications] = useState<LeaseApplication[]>([]);
  const [contracts, setContracts] = useState<LeaseContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<LeaseApplication | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [appsRes, contractsRes] = await Promise.all([
        supabase.from("lease_applications").select("*").order("created_at", { ascending: false }),
        supabase.from("lease_contracts").select("*").order("created_at", { ascending: false }),
      ]);

      if (appsRes.data) {
        // Fetch asset and profile info
        const assetIds = [...new Set(appsRes.data.map((a: any) => a.asset_id))];
        const userIds = [...new Set(appsRes.data.map((a: any) => a.user_id))];
        
        const [assetsRes, profilesRes] = await Promise.all([
          assetIds.length ? supabase.from("leaseable_assets").select("id, title, category, lease_price_monthly").in("id", assetIds) : { data: [] },
          userIds.length ? supabase.from("profiles").select("id, name, email").in("id", userIds) : { data: [] },
        ]);

        const assetsMap = Object.fromEntries((assetsRes.data || []).map((a: any) => [a.id, a]));
        const profilesMap = Object.fromEntries((profilesRes.data || []).map((p: any) => [p.id, p]));

        setApplications(appsRes.data.map((a: any) => ({
          ...a,
          asset: assetsMap[a.asset_id],
          applicant_profile: profilesMap[a.user_id],
        })));
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

        setContracts(contractsRes.data.map((c: any) => ({
          ...c,
          asset: assetsMap[c.asset_id],
          user_profile: profilesMap[c.user_id],
        })));
      }
    } catch (err) {
      console.error("Error fetching lease data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (app: LeaseApplication) => {
    try {
      // Update application
      await supabase.from("lease_applications").update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
      }).eq("id", app.id);

      // Create contract
      const contractNumber = `LC-${Date.now().toString(36).toUpperCase()}`;
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + app.lease_duration_months);

      await supabase.from("lease_contracts").insert({
        application_id: app.id,
        user_id: app.user_id,
        asset_id: app.asset_id,
        contract_number: contractNumber,
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
        monthly_payment: app.monthly_payment,
        security_deposit: app.security_deposit,
        total_due: app.monthly_payment * app.lease_duration_months,
        next_payment_date: startDate.toISOString().split("T")[0],
        payments_remaining: app.lease_duration_months,
      });

      // Update asset status
      await supabase.from("leaseable_assets").update({ status: "leased", is_available: false }).eq("id", app.asset_id);

      toast({ title: "Lease approved", description: `Contract ${contractNumber} created.` });
      fetchData();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to approve lease.", variant: "destructive" });
    }
  };

  const handleReject = async () => {
    if (!selectedApp) return;
    try {
      await supabase.from("lease_applications").update({
        status: "rejected",
        rejection_reason: rejectionReason,
        reviewed_at: new Date().toISOString(),
      }).eq("id", selectedApp.id);

      toast({ title: "Application rejected" });
      setReviewDialogOpen(false);
      setRejectionReason("");
      setSelectedApp(null);
      fetchData();
    } catch (err) {
      toast({ title: "Error", description: "Failed to reject.", variant: "destructive" });
    }
  };

  const handleSendReminder = async (contract: LeaseContract) => {
    toast({ title: "Reminder sent", description: `Payment reminder sent for contract ${contract.contract_number}.` });
  };

  const stats = {
    totalApplications: applications.length,
    pending: applications.filter(a => a.status === "pending").length,
    activeContracts: contracts.filter(c => c.status === "active").length,
    totalRevenue: contracts.reduce((sum, c) => sum + (c.total_paid || 0), 0),
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><FileText className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{stats.totalApplications}</p><p className="text-sm text-muted-foreground">Total Applications</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Clock className="h-8 w-8 text-yellow-500" /><div><p className="text-2xl font-bold">{stats.pending}</p><p className="text-sm text-muted-foreground">Pending Review</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Users className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">{stats.activeContracts}</p><p className="text-sm text-muted-foreground">Active Leases</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><DollarSign className="h-8 w-8 text-blue-500" /><div><p className="text-2xl font-bold">R{stats.totalRevenue.toLocaleString()}</p><p className="text-sm text-muted-foreground">Total Revenue</p></div></div></CardContent></Card>
      </div>

      <Tabs defaultValue="applications">
        <TabsList>
          <TabsTrigger value="applications">Applications ({applications.length})</TabsTrigger>
          <TabsTrigger value="contracts">Active Contracts ({contracts.filter(c => c.status === "active").length})</TabsTrigger>
          <TabsTrigger value="all-contracts">All Contracts ({contracts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="applications">
          <Card>
            <CardHeader><CardTitle>Lease Applications</CardTitle></CardHeader>
            <CardContent>
              {applications.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No lease applications yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Applicant</TableHead>
                      <TableHead>Asset</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Monthly</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {applications.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell>{app.applicant_profile?.name || app.applicant_name || "Unknown"}</TableCell>
                        <TableCell>{app.asset?.title || "Unknown Asset"}</TableCell>
                        <TableCell>{app.lease_duration_months} months</TableCell>
                        <TableCell>R{app.monthly_payment.toLocaleString()}</TableCell>
                        <TableCell><Badge className={statusColors[app.status] || ""}>{app.status}</Badge></TableCell>
                        <TableCell>{new Date(app.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {app.status === "pending" && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => handleApprove(app)}><CheckCircle className="h-4 w-4 text-green-500" /></Button>
                                <Button size="sm" variant="outline" onClick={() => { setSelectedApp(app); setReviewDialogOpen(true); }}><XCircle className="h-4 w-4 text-red-500" /></Button>
                              </>
                            )}
                            <Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button>
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
          <Card>
            <CardHeader><CardTitle>Active Lease Contracts</CardTitle></CardHeader>
            <CardContent>
              {contracts.filter(c => c.status === "active").length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No active contracts.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contract #</TableHead>
                      <TableHead>Lessee</TableHead>
                      <TableHead>Asset</TableHead>
                      <TableHead>Monthly</TableHead>
                      <TableHead>Paid/Due</TableHead>
                      <TableHead>Next Payment</TableHead>
                      <TableHead>Late</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.filter(c => c.status === "active").map((contract) => (
                      <TableRow key={contract.id}>
                        <TableCell className="font-mono text-sm">{contract.contract_number}</TableCell>
                        <TableCell>{contract.user_profile?.name || "Unknown"}</TableCell>
                        <TableCell>{contract.asset?.title || "Unknown"}</TableCell>
                        <TableCell>R{contract.monthly_payment.toLocaleString()}</TableCell>
                        <TableCell>R{(contract.total_paid || 0).toLocaleString()} / R{(contract.total_due || 0).toLocaleString()}</TableCell>
                        <TableCell>{contract.next_payment_date ? new Date(contract.next_payment_date).toLocaleDateString() : "-"}</TableCell>
                        <TableCell>
                          {contract.late_payments > 0 ? (
                            <Badge variant="destructive">{contract.late_payments}</Badge>
                          ) : (
                            <Badge variant="outline">0</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => handleSendReminder(contract)}><AlertTriangle className="h-4 w-4" /></Button>
                            <Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button>
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
          <Card>
            <CardHeader><CardTitle>All Contracts</CardTitle></CardHeader>
            <CardContent>
              {contracts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No contracts yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contract #</TableHead>
                      <TableHead>Lessee</TableHead>
                      <TableHead>Asset</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Total Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.map((contract) => (
                      <TableRow key={contract.id}>
                        <TableCell className="font-mono text-sm">{contract.contract_number}</TableCell>
                        <TableCell>{contract.user_profile?.name || "Unknown"}</TableCell>
                        <TableCell>{contract.asset?.title || "Unknown"}</TableCell>
                        <TableCell><Badge className={statusColors[contract.status] || ""}>{contract.status}</Badge></TableCell>
                        <TableCell>{new Date(contract.start_date).toLocaleDateString()} - {new Date(contract.end_date).toLocaleDateString()}</TableCell>
                        <TableCell>R{(contract.total_paid || 0).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Rejection Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Lease Application</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Provide a reason for rejection:</p>
            <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Reason for rejection..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject}>Reject Application</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLeases;
