import { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Check, ExternalLink, Loader2, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { callRewardRpc, ucToRand } from '@/lib/ucRewards';

interface Submission {
  id: string;
  user_id: string;
  proof_url: string | null;
  final_reward: number;
  created_at: string;
  task: { title: string } | null;
  person?: { name: string | null; email: string | null };
}

/** Pending task submissions: approve pays the UC, reject needs a reason. */
export function TaskSubmissionsReview({ onChanged }: { onChanged?: () => void }) {
  const { toast } = useToast();
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('mining_completions')
      .select('id, user_id, proof_url, final_reward, created_at, task:mining_tasks(title)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(100);
    const rows = (data ?? []) as unknown as Submission[];
    const ids = [...new Set(rows.map((r) => r.user_id))];
    if (ids.length) {
      const { data: people } = await supabase.from('profiles').select('id, name, email').in('id', ids);
      const byId = new Map((people ?? []).map((p) => [p.id, p]));
      rows.forEach((r) => { r.person = byId.get(r.user_id) ?? undefined; });
    }
    setItems(rows);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const review = async (item: Submission, approve: boolean) => {
    const reason = reasons[item.id]?.trim();
    if (!approve && !reason) {
      toast({ variant: 'destructive', title: 'Add a reason', description: 'Tell the user why it was rejected.' });
      return;
    }
    setBusy(item.id);
    try {
      const r = await callRewardRpc<{ success: boolean; error?: string; reward?: number }>(
        'admin_review_task_completion', { p_completion_id: item.id, p_approve: approve, p_reason: reason ?? null });
      if (!r.success) throw new Error(r.error);
      toast({
        title: approve ? `Approved: ${Number(r.reward ?? 0)} UC paid` : 'Rejected',
        description: approve && Number(r.reward) < item.final_reward
          ? 'Paid less than the task reward because the user reached their tier cap today.'
          : undefined,
      });
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      onChanged?.();
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: 'Could not review', description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Task submissions</CardTitle>
        <CardDescription>Check the link, then approve to pay the UC or reject with a reason.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : items.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nothing waiting for review.</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{item.task?.title ?? 'Task'}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.person?.name || 'User'} · {item.person?.email || item.user_id.slice(0, 8)} ·{' '}
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </p>
                </div>
                <span className="text-sm font-semibold whitespace-nowrap">
                  {item.final_reward} UC <span className="text-muted-foreground font-normal">({ucToRand(item.final_reward)})</span>
                </span>
              </div>
              {item.proof_url && /^https?:\/\//i.test(item.proof_url) ? (
                <a href={item.proof_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary underline break-all">
                  <ExternalLink className="h-3 w-3 shrink-0" /> {item.proof_url}
                </a>
              ) : (
                <p className="text-sm text-amber-600">No proof link provided.</p>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Reason (required to reject)"
                  value={reasons[item.id] ?? ''}
                  onChange={(e) => setReasons((r) => ({ ...r, [item.id]: e.target.value }))}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => review(item, true)} disabled={busy === item.id}>
                    <Check className="h-4 w-4 mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => review(item, false)} disabled={busy === item.id}>
                    <X className="h-4 w-4 mr-1" /> Reject
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
