import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Shield, TrendingDown, Users } from "lucide-react";

const AdminRiskMonitoring = () => {
  const [contracts, setContracts] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
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
    };
    fetchData();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" /></div>;

  const latePaymentUsers = contracts.filter(c => c.late_payments > 0);
  const defaultedContracts = contracts.filter(c => c.status === "defaulted");
  const overduePayments = payments.filter(p => p.status === "overdue");
  const overdueAmount = overduePayments.reduce((sum, p) => sum + p.amount, 0);
  const highRiskUsers = contracts.filter(c => c.late_payments >= 2 || c.status === "defaulted");

  // Risk scoring
  const getRiskLevel = (contract: any) => {
    if (contract.status === "defaulted") return { level: "Critical", color: "destructive" as const };
    if (contract.late_payments >= 3) return { level: "High", color: "destructive" as const };
    if (contract.late_payments >= 1) return { level: "Medium", color: "secondary" as const };
    return { level: "Low", color: "outline" as const };
  };

  return (
    <div className="space-y-6">
      {/* Risk Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><AlertTriangle className="h-8 w-8 text-red-500" /><div><p className="text-2xl font-bold">{highRiskUsers.length}</p><p className="text-sm text-muted-foreground">High Risk Users</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><TrendingDown className="h-8 w-8 text-orange-500" /><div><p className="text-2xl font-bold">{defaultedContracts.length}</p><p className="text-sm text-muted-foreground">Defaulted Contracts</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Shield className="h-8 w-8 text-yellow-500" /><div><p className="text-2xl font-bold">R{overdueAmount.toLocaleString()}</p><p className="text-sm text-muted-foreground">Overdue Amount</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Users className="h-8 w-8 text-blue-500" /><div><p className="text-2xl font-bold">{latePaymentUsers.length}</p><p className="text-sm text-muted-foreground">Late Payment Users</p></div></div></CardContent></Card>
      </div>

      {/* Risk Dashboard */}
      <Card>
        <CardHeader><CardTitle>Contract Risk Assessment</CardTitle></CardHeader>
        <CardContent>
          {contracts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No contracts to assess.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract #</TableHead>
                  <TableHead>Lessee</TableHead>
                  <TableHead>Monthly Payment</TableHead>
                  <TableHead>Late Payments</TableHead>
                  <TableHead>Credit Score</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.sort((a, b) => (b.late_payments || 0) - (a.late_payments || 0)).map((contract) => {
                  const risk = getRiskLevel(contract);
                  // Find credit score from application
                  const app = applications.find((a: any) => a.id === contract.application_id);
                  return (
                    <TableRow key={contract.id}>
                      <TableCell className="font-mono text-sm">{contract.contract_number}</TableCell>
                      <TableCell>{contract.profile?.name || "Unknown"}</TableCell>
                      <TableCell>R{contract.monthly_payment.toLocaleString()}</TableCell>
                      <TableCell>
                        {contract.late_payments > 0 ? (
                          <Badge variant="destructive">{contract.late_payments}</Badge>
                        ) : (
                          <span className="text-green-600">0</span>
                        )}
                      </TableCell>
                      <TableCell>{app?.credit_score || "N/A"}</TableCell>
                      <TableCell><Badge variant={risk.color}>{risk.level}</Badge></TableCell>
                      <TableCell className="capitalize">{contract.status}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Overdue Payments */}
      <Card>
        <CardHeader><CardTitle>Overdue Payments</CardTitle></CardHeader>
        <CardContent>
          {overduePayments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No overdue payments. 🎉</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Late Fee</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overduePayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{new Date(payment.due_date).toLocaleDateString()}</TableCell>
                    <TableCell>R{payment.amount.toLocaleString()}</TableCell>
                    <TableCell>R{(payment.late_fee || 0).toLocaleString()}</TableCell>
                    <TableCell className="capitalize">{payment.payment_type}</TableCell>
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
