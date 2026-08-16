import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";

type MiningRequest = {
  id: string;
  activity_code: string;
  status: string;
  reward_mg: number;
  fraud_score: number;
  rejection_reason: string | null;
  started_at: string;
  validated_at: string | null;
  credited_at: string | null;
  reference_type: string | null;
  reference_id: string | null;
};

const statusColor: Record<string, string> = {
  pending: "bg-muted text-foreground",
  validating: "bg-blue-100 text-blue-900",
  awaiting_verification: "bg-gold/10 text-gold",
  approved: "bg-emerald-100 text-emerald-900",
  credited: "bg-emerald-600 text-white",
  rejected: "bg-red-100 text-red-900",
  expired: "bg-muted text-muted-foreground",
  failed: "bg-red-200 text-red-950",
  reversed: "bg-orange-100 text-orange-900",
};

export default function MiningDashboardPage() {
  const [rows, setRows] = useState<MiningRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("mining_requests")
      .select("id,activity_code,status,reward_mg,fraud_score,rejection_reason,started_at,validated_at,credited_at,reference_type,reference_id")
      .order("created_at", { ascending: false })
      .limit(200);
    setRows((data ?? []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = filter === "all" ? rows : rows.filter(r => r.status === filter);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">UCoin Mining</h1>
          <p className="text-sm text-muted-foreground">
            Proof-of-Action rewards. Coins are credited only after your action is verified end-to-end.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {["all", "pending", "validating", "awaiting_verification", "credited", "rejected", "reversed"].map(s => (
          <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)}>
            {s.replace(/_/g, " ")}
          </Button>
        ))}
      </div>

      {loading && rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No mining requests yet. Complete actions like verified purchases, referrals, or reviews to earn UCoin.
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold capitalize">{r.activity_code.replace(/_/g, " ")}</span>
                    <Badge className={statusColor[r.status] ?? ""}>{r.status.replace(/_/g, " ")}</Badge>
                    {r.fraud_score > 40 && <Badge variant="outline">Risk {r.fraud_score}</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Started {format(new Date(r.started_at), "PPp")}
                    {r.credited_at && ` · Credited ${format(new Date(r.credited_at), "PPp")}`}
                    {r.validated_at && !r.credited_at && ` · Validated ${format(new Date(r.validated_at), "PPp")}`}
                  </div>
                  {r.reference_id && (
                    <div className="text-xs text-muted-foreground truncate">
                      Ref: {r.reference_type}/{r.reference_id}
                    </div>
                  )}
                  {r.rejection_reason && (
                    <div className="text-xs text-red-700 mt-1">Reason: {r.rejection_reason}</div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold">
                    {r.status === "credited" ? "+" : ""}{r.reward_mg}
                  </div>
                  <div className="text-xs text-muted-foreground">UCoin</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
