import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Loader2, CheckCircle2, XCircle, Lock, Unlock, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { fintech } from "@/services/fintech";

const fmtR = (n: number) => `R${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const AdminFintechPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [audit, setAudit] = useState<any[]>([]);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [overview, auditRes] = await Promise.all([
        fintech.adminCall("overview"),
        fintech.adminCall("audit_log"),
      ]);
      setData(overview); setAudit(auditRes.audit || []);
    } catch (e) {
      toast({ variant: "destructive", title: "Failed to load", description: (e as Error).message });
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const review = async (id: string, decision: "approve" | "reject", reason?: string) => {
    try {
      await fintech.adminCall("review_withdrawal", { withdrawal_id: id, decision, reason });
      toast({ title: `Withdrawal ${decision}d` }); setRejectFor(null); setRejectReason(""); load();
    } catch (e) { toast({ variant: "destructive", title: "Failed", description: (e as Error).message }); }
  };
  const verifyBank = async (id: string, approve: boolean) => {
    try { await fintech.adminCall("verify_bank", { bank_id: id, approve }); toast({ title: `Bank ${approve ? "verified" : "rejected"}` }); load(); }
    catch (e) { toast({ variant: "destructive", title: "Failed", description: (e as Error).message }); }
  };
  const freezeUser = async (userId: string, freeze: boolean) => {
    try { await fintech.adminCall("freeze_wallet", { user_id: userId, freeze }); toast({ title: freeze ? "Wallet frozen" : "Wallet reactivated" }); load(); }
    catch (e) { toast({ variant: "destructive", title: "Failed", description: (e as Error).message }); }
  };
  const resolveFlag = async (id: string) => {
    try { await fintech.adminCall("resolve_flag", { event_id: id }); load(); }
    catch (e) { toast({ variant: "destructive", title: "Failed", description: (e as Error).message }); }
  };

  const exportCsv = () => {
    const rows = (data?.recentLedger || []) as any[];
    const header = ["created_at","user_id","direction","bucket","amount","currency","type","status","provider","provider_reference"];
    const csv = [header.join(","), ...rows.map(r => header.map(h => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `1145-ledger-${Date.now()}.csv`; a.click();
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );

  const withdrawals = (data?.withdrawals || []) as any[];
  const flagged = (data?.flagged || []) as any[];
  const frozen = (data?.frozen || []) as any[];
  const ledger = (data?.recentLedger || []) as any[];
  const pendingWd = withdrawals.filter(w => w.status === "pending");

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto flex items-center gap-3 px-4 h-14">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold tracking-tight">Fintech Console</h1>
          <Badge variant="secondary" className="ml-2 gap-1"><ShieldCheck className="h-3 w-3 text-emerald-500" />Admin</Badge>
          <Button size="sm" variant="outline" className="ml-auto" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />Export CSV</Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-5 space-y-5 max-w-6xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Pending withdrawals" value={pendingWd.length} />
          <StatCard label="Open flags" value={flagged.length} />
          <StatCard label="Frozen wallets" value={frozen.length} />
          <StatCard label="Ledger entries (recent)" value={ledger.length} />
        </div>

        <Tabs defaultValue="withdrawals">
          <TabsList className="flex w-full overflow-x-auto no-scrollbar justify-start sm:grid sm:grid-cols-5">
            <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
            <TabsTrigger value="flags">Flagged</TabsTrigger>
            <TabsTrigger value="frozen">Frozen</TabsTrigger>
            <TabsTrigger value="ledger">Ledger</TabsTrigger>
            <TabsTrigger value="audit">Audit</TabsTrigger>
          </TabsList>

          <TabsContent value="withdrawals" className="mt-4 space-y-2">
            {withdrawals.length === 0 ? <EmptyRow text="No withdrawal requests." /> : withdrawals.map((w) => (
              <Card key={w.id}>
                <CardContent className="flex flex-wrap items-center gap-3 py-3">
                  <div className="flex-1 min-w-0 sm:min-w-[13.75rem]">
                    <p className="font-medium">{fmtR(w.amount)} · <span className="capitalize">{w.status}</span></p>
                    <p className="text-xs text-muted-foreground">User: {w.user_id}</p>
                    <p className="text-xs text-muted-foreground">Created: {new Date(w.created_at).toLocaleString()}</p>
                    {w.fraud_score ? <Badge variant="destructive" className="mt-1">Fraud score {w.fraud_score}</Badge> : null}
                    {w.rejection_reason && <p className="text-xs text-destructive mt-1">{w.rejection_reason}</p>}
                  </div>
                  {w.status === "pending" && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => review(w.id, "approve")}>Approve</Button>
                      <Button size="sm" variant="destructive" onClick={() => setRejectFor(w.id)}>Reject</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="flags" className="mt-4 space-y-2">
            {flagged.length === 0 ? <EmptyRow text="No open fraud signals." /> : flagged.map((f) => (
              <Card key={f.id}>
                <CardContent className="flex items-center gap-3 py-3">
                  <div className="flex-1">
                    <p className="font-medium capitalize">{f.event_type.replace(/_/g, " ")} · Risk {f.risk_score}</p>
                    <p className="text-xs text-muted-foreground">User: {f.user_id || "unknown"} · {new Date(f.created_at).toLocaleString()}</p>
                    <pre className="text-[11px] mt-1 text-muted-foreground overflow-x-auto">{JSON.stringify(f.signals, null, 2)}</pre>
                  </div>
                  <div className="flex flex-col gap-2">
                    {f.user_id && <Button size="sm" variant="outline" onClick={() => freezeUser(f.user_id, true)}><Lock className="h-3 w-3 mr-1" />Freeze</Button>}
                    <Button size="sm" onClick={() => resolveFlag(f.id)}>Resolve</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="frozen" className="mt-4 space-y-2">
            {frozen.length === 0 ? <EmptyRow text="No frozen wallets." /> : frozen.map((w) => (
              <Card key={w.id}>
                <CardContent className="flex items-center gap-3 py-3">
                  <div className="flex-1">
                    <p className="font-medium">User: {w.user_id}</p>
                    <p className="text-xs text-muted-foreground">Balance: {fmtR(w.available_balance)}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => freezeUser(w.user_id, false)}><Unlock className="h-3 w-3 mr-1" />Unfreeze</Button>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="ledger" className="mt-4 space-y-1">
            {ledger.map((l) => (
              <Card key={l.id}><CardContent className="flex items-center gap-3 py-2 text-xs">
                <span className="w-40 truncate">{new Date(l.created_at).toLocaleString()}</span>
                <span className="capitalize w-24">{l.type.replace(/_/g, " ")}</span>
                <span className={`w-24 font-semibold ${l.direction === "credit" ? "text-emerald-600" : "text-destructive"}`}>{l.direction === "credit" ? "+" : "−"}{fmtR(l.amount)}</span>
                <span className="w-16">{l.bucket}</span>
                <span className="truncate flex-1 text-muted-foreground">{l.user_id}</span>
                <span className="truncate w-32 text-muted-foreground">{l.provider_reference || ""}</span>
              </CardContent></Card>
            ))}
          </TabsContent>

          <TabsContent value="audit" className="mt-4 space-y-1">
            {audit.map((a) => (
              <Card key={a.id}><CardContent className="flex items-center gap-3 py-2 text-xs">
                <span className="w-40 truncate">{new Date(a.created_at).toLocaleString()}</span>
                <span className="w-32 font-medium">{a.action}</span>
                <span className="w-32 truncate">{a.target_type}:{a.target_id}</span>
                <span className="flex-1 truncate text-muted-foreground">{JSON.stringify(a.details)}</span>
              </CardContent></Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!rejectFor} onOpenChange={(v) => !v && setRejectFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject withdrawal</DialogTitle></DialogHeader>
          <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason (shown to the user)" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectFor(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => rejectFor && review(rejectFor, "reject", rejectReason)}>Reject & refund</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <Card><CardHeader className="pb-2"><CardDescription>{label}</CardDescription><CardTitle className="text-2xl">{value}</CardTitle></CardHeader></Card>
);
const EmptyRow: React.FC<{ text: string }> = ({ text }) => (
  <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{text}</CardContent></Card>
);

export default AdminFintechPage;
