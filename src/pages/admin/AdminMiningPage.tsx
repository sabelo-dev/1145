import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

type Row = {
  id: string;
  user_id: string;
  activity_code: string;
  status: string;
  reward_mg: number;
  fraud_score: number;
  rejection_reason: string | null;
  started_at: string;
  reference_type: string | null;
  reference_id: string | null;
};

export default function AdminMiningPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [health, setHealth] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: q }, { data: all }] = await Promise.all([
      supabase.from("mining_requests")
        .select("id,user_id,activity_code,status,reward_mg,fraud_score,rejection_reason,started_at,reference_type,reference_id")
        .in("status", ["awaiting_verification", "validating", "pending"])
        .order("started_at", { ascending: true })
        .limit(100),
      supabase.from("mining_requests").select("status"),
    ]);
    setRows((q ?? []) as any);
    const counts: Record<string, number> = {};
    (all ?? []).forEach((r: any) => { counts[r.status] = (counts[r.status] ?? 0) + 1; });
    setHealth(counts);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const runWorker = async () => {
    setBusy("worker");
    const { data, error } = await supabase.functions.invoke("ucoin-mining?action=worker", { body: {} });
    setBusy(null);
    if (error) toast.error(error.message);
    else toast.success(`Processed ${(data as any)?.processed ?? 0} jobs`);
    load();
  };

  const decide = async (request_id: string, decision: "approve" | "reject") => {
    setBusy(request_id);
    const { error } = await supabase.functions.invoke("ucoin-mining?action=admin/decision", {
      body: { request_id, decision, reason: reasons[request_id] ?? "" },
    });
    setBusy(null);
    if (error) toast.error(error.message);
    else { toast.success(decision === "approve" ? "Approved" : "Rejected"); load(); }
  };

  const reverse = async (request_id: string) => {
    const reason = reasons[request_id];
    if (!reason) return toast.error("Reason required");
    setBusy(request_id);
    const { error } = await supabase.functions.invoke("ucoin-mining?action=admin/reverse", {
      body: { request_id, reason },
    });
    setBusy(null);
    if (error) toast.error(error.message);
    else { toast.success("Reversed"); load(); }
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">UCoin Mining · Admin</h1>
        <Button onClick={runWorker} disabled={busy === "worker"}>
          {busy === "worker" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Run worker
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        {["pending", "validating", "awaiting_verification", "credited", "rejected", "reversed"].map(s => (
          <Card key={s} className="p-3">
            <div className="text-xs text-muted-foreground capitalize">{s.replace(/_/g, " ")}</div>
            <div className="text-2xl font-bold">{health[s] ?? 0}</div>
          </Card>
        ))}
      </div>

      <h2 className="text-lg font-semibold mb-3">Review queue</h2>
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Queue empty.</Card>
      ) : (
        <div className="space-y-3">
          {rows.map(r => (
            <Card key={r.id} className="p-4">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold capitalize">{r.activity_code.replace(/_/g, " ")}</span>
                    <Badge variant="outline">{r.status.replace(/_/g, " ")}</Badge>
                    <Badge variant={r.fraud_score >= 41 ? "destructive" : "secondary"}>Risk {r.fraud_score}</Badge>
                    <span className="text-sm font-semibold">+{r.reward_mg} UCoin</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    User {r.user_id.slice(0, 8)}… · Started {format(new Date(r.started_at), "PPp")}
                  </div>
                  {r.reference_id && (
                    <div className="text-xs text-muted-foreground truncate">Ref: {r.reference_type}/{r.reference_id}</div>
                  )}
                  <Textarea
                    placeholder="Reason (required for reject/reverse)"
                    className="mt-2"
                    value={reasons[r.id] ?? ""}
                    onChange={e => setReasons(v => ({ ...v, [r.id]: e.target.value }))}
                  />
                </div>
                <div className="flex md:flex-col gap-2 shrink-0">
                  <Button size="sm" onClick={() => decide(r.id, "approve")} disabled={busy === r.id}>Approve</Button>
                  <Button size="sm" variant="destructive" onClick={() => decide(r.id, "reject")} disabled={busy === r.id}>Reject</Button>
                  <Button size="sm" variant="outline" onClick={() => reverse(r.id)} disabled={busy === r.id}>Reverse</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
