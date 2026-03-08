import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { FileText, Calendar, DollarSign, AlertTriangle, TrendingUp, ExternalLink, Package } from "lucide-react";
import type { LeaseContract, LeasePayment } from "@/types/leasing";

const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "active": case "renewed": return "default";
    case "completed": return "secondary";
    case "terminated": case "defaulted": return "destructive";
    default: return "outline";
  }
};

const ConsumerLeases = () => {
  const { user } = useAuth();
  const [contracts, setContracts] = useState<(LeaseContract & { asset?: any })[]>([]);
  const [payments, setPayments] = useState<LeasePayment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const [contractsRes, paymentsRes] = await Promise.all([
      supabase.from("lease_contracts").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("lease_payments").select("*").eq("user_id", user.id).order("due_date", { ascending: false }),
    ]);

    if (contractsRes.data) {
      const assetIds = [...new Set(contractsRes.data.map((c: any) => c.asset_id))];
      const assetsRes = assetIds.length ? await supabase.from("leaseable_assets").select("id, title, category, images").in("id", assetIds) : { data: [] };
      const assetsMap = Object.fromEntries((assetsRes.data || []).map((a: any) => [a.id, a]));
      setContracts(contractsRes.data.map((c: any) => ({ ...c, asset: assetsMap[c.asset_id] })));
    }
    if (paymentsRes.data) setPayments(paymentsRes.data as any);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { if (user?.id) fetchData(); }, [user?.id, fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
        <Skeleton className="h-10 w-80" />
        {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
      </div>
    );
  }

  const activeContracts = contracts.filter(c => c.status === "active");
  const upcomingPayments = payments.filter(p => p.status === "pending");
  const totalMonthly = activeContracts.reduce((sum, c) => sum + c.monthly_payment, 0);

  const statCards = [
    { label: "Active Leases", value: activeContracts.length.toString(), icon: FileText, color: "text-primary", bg: "bg-primary/10" },
    { label: "Monthly Total", value: `R${totalMonthly.toLocaleString()}`, icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { label: "Upcoming Payments", value: upcomingPayments.length.toString(), icon: Calendar, color: "text-blue-600", bg: "bg-blue-500/10" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

      <Tabs defaultValue="active">
        <TabsList className="rounded-xl">
          <TabsTrigger value="active" className="rounded-lg">Active ({activeContracts.length})</TabsTrigger>
          <TabsTrigger value="payments" className="rounded-lg">Payments ({payments.length})</TabsTrigger>
          <TabsTrigger value="all" className="rounded-lg">All ({contracts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {activeContracts.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-muted mb-4"><Package className="h-8 w-8 text-muted-foreground" /></div>
                <h3 className="font-semibold text-lg mb-1">No Active Leases</h3>
                <p className="text-sm text-muted-foreground mb-4">You don't have any active leases yet.</p>
                <Button variant="outline" className="rounded-xl" onClick={() => window.location.href = "/shop?type=lease"}>
                  <ExternalLink className="h-4 w-4 mr-2" />Browse Leaseable Assets
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {activeContracts.map(contract => {
                const progress = contract.total_due > 0 ? (contract.total_paid / contract.total_due) * 100 : 0;
                return (
                  <Card key={contract.id} className="border-0 ring-1 ring-border overflow-hidden hover:shadow-md transition-all">
                    <CardContent className="p-5">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="space-y-2">
                          <h3 className="font-bold text-lg">{contract.asset?.title || "Asset"}</h3>
                          <p className="text-xs font-mono text-muted-foreground">{contract.contract_number}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={statusVariant(contract.status)} className="rounded-full capitalize">{contract.status}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(contract.start_date).toLocaleDateString()} — {new Date(contract.end_date).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <p className="text-2xl font-black tracking-tight">
                            R{contract.monthly_payment.toLocaleString()}
                            <span className="text-sm font-normal text-muted-foreground">/mo</span>
                          </p>
                          {contract.next_payment_date && (
                            <p className="text-xs text-muted-foreground">
                              Next: <span className="font-medium text-foreground">{new Date(contract.next_payment_date).toLocaleDateString()}</span>
                            </p>
                          )}
                          {contract.late_payments > 0 && (
                            <Badge variant="destructive" className="rounded-full text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />{contract.late_payments} late
                            </Badge>
                          )}
                        </div>
                      </div>

                      <Separator className="my-4" />

                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-muted-foreground">R{contract.total_paid.toLocaleString()} paid</span>
                          <span className="font-medium">R{contract.total_due.toLocaleString()} total</span>
                        </div>
                        <Progress value={progress} className="h-2 [&>div]:bg-primary" />
                        <p className="text-xs text-muted-foreground mt-1.5">{contract.payments_remaining} payments remaining</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="payments">
          <Card className="border-0 ring-1 ring-border">
            <CardContent className="p-0">
              {payments.length === 0 ? (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-muted mb-4"><DollarSign className="h-8 w-8 text-muted-foreground" /></div>
                  <h3 className="font-semibold text-lg mb-1">No Payments</h3>
                  <p className="text-sm text-muted-foreground">Your payment history will appear here.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Due Date</TableHead><TableHead>Amount</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Paid At</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {payments.map(payment => (
                      <TableRow key={payment.id} className="hover:bg-muted/30">
                        <TableCell className="text-sm">{new Date(payment.due_date).toLocaleDateString()}</TableCell>
                        <TableCell className="font-mono">R{payment.amount.toLocaleString()}</TableCell>
                        <TableCell><Badge variant="outline" className="rounded-full capitalize">{payment.payment_type}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={payment.status === "paid" ? "default" : payment.status === "overdue" ? "destructive" : "secondary"} className="rounded-full capitalize">
                            {payment.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{payment.paid_at ? new Date(payment.paid_at).toLocaleDateString() : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card className="border-0 ring-1 ring-border">
            <CardContent className="p-0">
              {contracts.length === 0 ? (
                <div className="text-center py-16"><p className="text-muted-foreground">No lease history.</p></div>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Contract #</TableHead><TableHead>Asset</TableHead><TableHead>Status</TableHead><TableHead>Period</TableHead><TableHead>Total Paid</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {contracts.map(contract => (
                      <TableRow key={contract.id} className="hover:bg-muted/30">
                        <TableCell className="font-mono text-sm">{contract.contract_number}</TableCell>
                        <TableCell className="font-medium">{contract.asset?.title || "Unknown"}</TableCell>
                        <TableCell><Badge variant={statusVariant(contract.status)} className="rounded-full capitalize">{contract.status}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(contract.start_date).toLocaleDateString()} — {new Date(contract.end_date).toLocaleDateString()}</TableCell>
                        <TableCell className="font-mono">R{contract.total_paid.toLocaleString()}</TableCell>
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
