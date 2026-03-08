import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { FileText, Calendar, DollarSign, AlertTriangle, RefreshCw } from "lucide-react";
import type { LeaseContract, LeasePayment } from "@/types/leasing";

const ConsumerLeases = () => {
  const { user } = useAuth();
  const [contracts, setContracts] = useState<(LeaseContract & { asset?: any })[]>([]);
  const [payments, setPayments] = useState<LeasePayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) fetchData();
  }, [user?.id]);

  const fetchData = async () => {
    setLoading(true);
    const [contractsRes, paymentsRes] = await Promise.all([
      supabase.from("lease_contracts").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
      supabase.from("lease_payments").select("*").eq("user_id", user!.id).order("due_date", { ascending: false }),
    ]);

    if (contractsRes.data) {
      const assetIds = [...new Set(contractsRes.data.map((c: any) => c.asset_id))];
      const assetsRes = assetIds.length ? await supabase.from("leaseable_assets").select("id, title, category, images").in("id", assetIds) : { data: [] };
      const assetsMap = Object.fromEntries((assetsRes.data || []).map((a: any) => [a.id, a]));
      setContracts(contractsRes.data.map((c: any) => ({ ...c, asset: assetsMap[c.asset_id] })));
    }
    if (paymentsRes.data) setPayments(paymentsRes.data as any);
    setLoading(false);
  };

  if (loading) return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" /></div>;

  const activeContracts = contracts.filter(c => c.status === "active");
  const upcomingPayments = payments.filter(p => p.status === "pending");
  const totalMonthly = activeContracts.reduce((sum, c) => sum + c.monthly_payment, 0);

  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-800", completed: "bg-blue-100 text-blue-800",
    terminated: "bg-red-100 text-red-800", defaulted: "bg-red-200 text-red-900", renewed: "bg-purple-100 text-purple-800",
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><FileText className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{activeContracts.length}</p><p className="text-sm text-muted-foreground">Active Leases</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><DollarSign className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">R{totalMonthly.toLocaleString()}</p><p className="text-sm text-muted-foreground">Monthly Total</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Calendar className="h-8 w-8 text-blue-500" /><div><p className="text-2xl font-bold">{upcomingPayments.length}</p><p className="text-sm text-muted-foreground">Upcoming Payments</p></div></div></CardContent></Card>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active Leases ({activeContracts.length})</TabsTrigger>
          <TabsTrigger value="payments">Payment History ({payments.length})</TabsTrigger>
          <TabsTrigger value="all">All Leases ({contracts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {activeContracts.length === 0 ? (
            <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">You don't have any active leases.</p><Button className="mt-4" variant="outline" onClick={() => window.location.href = "/shop?type=lease"}>Browse Leaseable Assets</Button></CardContent></Card>
          ) : (
            <div className="grid gap-4">
              {activeContracts.map(contract => {
                const progress = contract.total_due > 0 ? (contract.total_paid / contract.total_due) * 100 : 0;
                return (
                  <Card key={contract.id}>
                    <CardContent className="pt-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-lg">{contract.asset?.title || "Asset"}</h3>
                          <p className="text-sm text-muted-foreground font-mono">{contract.contract_number}</p>
                          <div className="flex gap-2 mt-2">
                            <Badge className={statusColors[contract.status]}>{contract.status}</Badge>
                            <span className="text-sm text-muted-foreground">{new Date(contract.start_date).toLocaleDateString()} - {new Date(contract.end_date).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">R{contract.monthly_payment.toLocaleString()}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                          {contract.next_payment_date && <p className="text-sm text-muted-foreground">Next: {new Date(contract.next_payment_date).toLocaleDateString()}</p>}
                          {contract.late_payments > 0 && <Badge variant="destructive" className="mt-1"><AlertTriangle className="h-3 w-3 mr-1" />{contract.late_payments} late</Badge>}
                        </div>
                      </div>
                      <div className="mt-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span>R{contract.total_paid.toLocaleString()} paid</span>
                          <span>R{contract.total_due.toLocaleString()} total</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-1">{contract.payments_remaining} payments remaining</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardContent className="pt-6">
              {payments.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No payment history.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Paid At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map(payment => (
                      <TableRow key={payment.id}>
                        <TableCell>{new Date(payment.due_date).toLocaleDateString()}</TableCell>
                        <TableCell>R{payment.amount.toLocaleString()}</TableCell>
                        <TableCell className="capitalize">{payment.payment_type}</TableCell>
                        <TableCell>
                          <Badge variant={payment.status === "paid" ? "outline" : payment.status === "overdue" ? "destructive" : "secondary"}>
                            {payment.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{payment.paid_at ? new Date(payment.paid_at).toLocaleDateString() : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardContent className="pt-6">
              {contracts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No lease history.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contract #</TableHead>
                      <TableHead>Asset</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Total Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.map(contract => (
                      <TableRow key={contract.id}>
                        <TableCell className="font-mono text-sm">{contract.contract_number}</TableCell>
                        <TableCell>{contract.asset?.title || "Unknown"}</TableCell>
                        <TableCell><Badge className={statusColors[contract.status]}>{contract.status}</Badge></TableCell>
                        <TableCell>{new Date(contract.start_date).toLocaleDateString()} - {new Date(contract.end_date).toLocaleDateString()}</TableCell>
                        <TableCell>R{contract.total_paid.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConsumerLeases;
