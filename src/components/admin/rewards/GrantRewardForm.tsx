import { useEffect, useMemo, useState } from 'react';
import { Gift, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { callRewardRpc, fetchRewardRules, ruleRewardLabel, ucToRand, type RewardRule } from '@/lib/ucRewards';

/**
 * Admin-run rewards: surveys, driver targets, campaigns, sponsored tasks,
 * photo/video reviews, Service Hub cashback, affiliate sales, top-ups.
 * The database enforces each rule's range (admin_grant_reward).
 */
export function GrantRewardForm() {
  const { toast } = useToast();
  const [rules, setRules] = useState<RewardRule[]>([]);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchRewardRules()
      .then((all) => setRules(all.filter((r) => r.admin_granted || r.reward_kind !== 'fixed')))
      .catch(() => setRules([]));
  }, []);

  const rule = useMemo(() => rules.find((r) => r.code === code), [rules, code]);
  const uc = rule?.reward_kind === 'fixed' ? Number(rule.reward_mg) : Number(amount) || 0;

  const submit = async () => {
    if (!rule) return;
    setSubmitting(true);
    try {
      const { data: person } = await supabase
        .from('profiles').select('id, name').ilike('email', email.trim()).maybeSingle();
      if (!person) throw new Error('No user with that email');
      const r = await callRewardRpc<{ success: boolean; error?: string; reward?: number }>('admin_grant_reward', {
        p_user_id: person.id, p_rule: rule.code, p_amount: uc, p_reason: reason.trim(), p_reference: reference.trim() || null,
      });
      if (!r.success) throw new Error(r.error);
      const paid = Number(r.reward ?? 0);
      toast({
        title: `${paid} UC granted to ${person.name || email}`,
        description: paid < uc ? `Capped: the user had only ${paid} UC left of today's tier limit.` : undefined,
      });
      setAmount(''); setReason(''); setReference('');
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: 'Grant failed', description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5" /> Grant a reward</CardTitle>
        <CardDescription>For rewards 1145 approves by hand. Amounts must fall inside each rule's range.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-xl">
        <div className="space-y-2">
          <Label htmlFor="grant-email">User email</Label>
          <Input id="grant-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
        </div>
        <div className="space-y-2">
          <Label>Reward</Label>
          <Select value={code} onValueChange={(v) => { setCode(v); setAmount(''); }}>
            <SelectTrigger><SelectValue placeholder="Choose a reward" /></SelectTrigger>
            <SelectContent>
              {rules.map((r) => (
                <SelectItem key={r.code} value={r.code}>{r.display_name} · {ruleRewardLabel(r)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {rule?.conditions && <p className="text-xs text-muted-foreground">{rule.conditions}</p>}
        </div>
        {rule && rule.reward_kind !== 'fixed' && (
          <div className="space-y-2">
            <Label htmlFor="grant-amount">
              Amount (UC){rule.reward_kind === 'range' ? ` · ${rule.min_reward}–${rule.max_reward}` : ''}
            </Label>
            <Input id="grant-amount" type="number" min={rule.min_reward ?? 1} max={rule.max_reward ?? undefined}
              value={amount} onChange={(e) => setAmount(e.target.value)} />
            {rule.reward_kind === 'percent' && (
              <p className="text-xs text-muted-foreground">Work out the UC: Rand amount × rate × 10 (1 UC = R0.10).</p>
            )}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="grant-reason">Reason (shown in the user's wallet)</Label>
          <Input id="grant-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer survey, September" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="grant-ref">Reference (optional, prevents paying twice)</Label>
          <Input id="grant-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. survey-2026-09" />
        </div>
        <Button onClick={submit} disabled={submitting || !rule || !email.trim() || !reason.trim() || uc <= 0}>
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Grant {uc > 0 ? `${uc} UC (${ucToRand(uc)})` : ''}
        </Button>
      </CardContent>
    </Card>
  );
}
