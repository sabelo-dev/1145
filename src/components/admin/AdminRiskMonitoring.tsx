import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Shield, TrendingDown, Users, ShieldAlert, CheckCircle } from "lucide-react";

const AdminRiskMonitoring = () => {
  const [contracts, setContracts] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [contractsRes, paymentsRes, appsRes] = await Promise.all([
      supabase.from("lease_contracts").select("*"),
      supabase.from("lease_payments").select("*"),
      supabase.from("lease_applications").select("*"),
    ]);
    if (contractsRes.data) {
      const userIds = [...new Set(contractsRes.data.map((c: any) => c.user_id))];
      const profilesRes = userIds.length ? await supabase.from("profiles").select("id, name, email").in("id", userIds) : { data: [] };
      const profilesMap = Object.fromEntries((profilesRes.data || []).map((p: any) => [p.id, p]));
      setContracts(contractsRes.data.map((c: any) => ({ ...c, profile: profilesMap[c.user_id] })));
    }
    if (paymentsRes.data) setPayments(paymentsRes.data);
    if (appsRes.data) setApplications(appsRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const latePaymentUsers = contracts.filter(c => c.late_payments > 0);
  const defaultedContracts = contracts.filter(c => c.status === "defaulted");
  const overduePayments = payments.filter(p => p.status === "overdue");
  const overdueAmount = overduePayments.reduce((sum, p) => sum + p.amount, 0);
  const highRiskUsers = contracts.filter(c => c.late_payments >= 2 || c.status === "defaulted");

  const getRiskLevel = (contract: any) => {
    if (contract.status === "defaulted") return { level: "Critical", variant: "destructive" as const };
    if (contract.late_payments >= 3) return { level: "High", variant: "destructive" as const };
    if (contract.late_payments >= 1) return { level: "Medium", variant: "secondary" as const };
    return { level: "Low", variant: "outline" as const };
  };

  const statCards = [
    { label: "High Risk Users", value: highRiskUsers.length, icon: ShieldAlert, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Defaulted Contracts", value: defaultedContracts.length, icon: TrendingDown, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Overdue Amount", value: `R${overdueAmount.toLocaleString()}`, icon: Shield, color: "text-amber-600", bg: "bg-amber-500/10" },
    { label: "Late Payment Users", value: latePaymentUsers.length, icon: Users, color: "text-blue-600", bg: "bg-blue-500/10" },
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

      <Card className="border-0 ring-1 ring-border">
        <CardHeader><CardTitle className="text-base font-semibold">Contract Risk Assessment</CardTitle></CardHeader>
        <CardContent className="p-0">
          {contracts.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-muted mb-4"><CheckCircle className="h-8 w-8 text-muted-foreground" /></div>
              <h3 className="font-semibold text-lg mb-1">No Contracts</h3>
              <p className="text-sm text-muted-foreground">No contracts to assess.</p>
            </div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Contract #</TableHead><TableHead>Lessee</TableHead><TableHead>Monthly</TableHead>
                <TableHead>Late</TableHead><TableHead>Credit Score</TableHead><TableHead>Risk</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {contracts.sort((a, b) => (b.late_payments || 0) - (a.late_payments || 0)).map((contract) => {
                  const risk = getRiskLevel(contract);
                  const app = applications.find((a: any) => a.id === contract.application_id);
                  return (
                    <TableRow key={contract.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-sm">{contract.contract_number}</TableCell>
                      <TableCell className="font-medium">{contract.profile?.name || "Unknown"}</TableCell>
                      <TableCell className="font-mono">R{contract.monthly_payment.toLocaleString()}</TableCell>
                      <TableCell>
                        {contract.late_payments > 0 ? (
                          <Badge variant="destructive" className="rounded-full">{contract.late_payments}</Badge>
                        ) : (
                          <span className="text-emerald-600 text-sm font-medium">0</span>
                        )}
                      </TableCell>
                      <TableCell>{app?.credit_score || "N/A"}</TableCell>
                      <TableCell><Badge variant={risk.variant} className="rounded-full">{risk.level}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className="rounded-full capitalize">{contract.status}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 ring-1 ring-border">
        <CardHeader><CardTitle className="text-base font-semibold">Overdue Payments</CardTitle></CardHeader>
        <CardContent className="p-0">
          {overduePayments.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-emerald-500/10 mb-4"><CheckCircle className="h-8 w-8 text-emerald-600" /></div>
              <h3 className="font-semibold text-lg mb-1">All Clear!</h3>
              <p className="text-sm text-muted-foreground">No overdue payments. 🎉</p>
            </div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Due Date</TableHead><TableHead>Amount</TableHead><TableHead>Late Fee</TableHead><TableHead>Type</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {overduePayments.map((payment) => (
                  <TableRow key={payment.id} className="hover:bg-muted/30">
                    <TableCell className="text-sm">{new Date(payment.due_date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-mono">R{payment.amount.toLocaleString()}</TableCell>
                    <TableCell className="font-mono text-destructive">R{(payment.late_fee || 0).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline" className="rounded-full capitalize">{payment.payment_type}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminRiskMonitoring;
