import { useCallback, useEffect, useState } from 'react';
import { Edit, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ruleRewardLabel, ucToRand, type RewardRule } from '@/lib/ucRewards';

type Rule = RewardRule & { is_active: boolean; cap_category: string | null };

// mining_activities' new columns are not in the generated types yet.
const activities = () => (supabase.from as unknown as (t: string) => ReturnType<typeof supabase.from>)('mining_activities');

const randLabel = (r: Rule) =>
  r.reward_kind === 'percent'
    ? 'Variable'
    : r.reward_kind === 'range'
      ? `${ucToRand(Number(r.min_reward))}–${ucToRand(Number(r.max_reward))}`
      : ucToRand(Number(r.reward_mg));

/**
 * The live UC reward catalogue (public.mining_activities): what the reward
 * triggers, check-in, tasks and admin grants actually pay.
 */
export function RewardRulesManager() {
  const { toast } = useToast();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await activities().select('*').lt('sort_order', 1000).order('sort_order');
    if (error) toast({ variant: 'destructive', title: 'Could not load reward rules', description: error.message });
    setRules((data ?? []) as unknown as Rule[]);
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    if (editing.reward_kind !== 'fixed' && Number(editing.min_reward) > Number(editing.max_reward)) {
      toast({ variant: 'destructive', title: 'Minimum is above maximum' });
      return;
    }
    setSaving(true);
    const { error } = await activities()
      .update({
        reward_mg: editing.reward_mg,
        min_reward: editing.min_reward,
        max_reward: editing.max_reward,
        daily_cap: editing.daily_cap,
        is_active: editing.is_active,
      } as never)
      .eq('code', editing.code);
    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Save failed', description: error.message });
      return;
    }
    toast({ title: `${editing.display_name} updated` });
    setEditing(null);
    load();
  };

  const groups = rules.reduce<Record<string, Rule[]>>((acc, r) => {
    (acc[r.audience || 'Other'] ??= []).push(r);
    return acc;
  }, {});

  const num = (v: string) => (v === '' ? null : Number(v));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reward rules</CardTitle>
        <CardDescription>
          What UC pays for (1 UC = R0.10). Automatic rules are paid by the system when the event happens;
          "Admin" rules are paid through task approval or Grant reward. Rules marked "Tier cap" count towards
          the user's daily and 30-day limits.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : rules.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No reward rules yet. Run the UC ecosystem migration (20261001090000_uc_ecosystem.sql).
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Activity</TableHead>
                  <TableHead>UC</TableHead>
                  <TableHead>Rand</TableHead>
                  <TableHead>Conditions</TableHead>
                  <TableHead>Paid by</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(groups).map(([audience, list]) => [
                  <TableRow key={`h-${audience}`} className="bg-muted/40 hover:bg-muted/40">
                    <TableCell colSpan={7} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{audience}</TableCell>
                  </TableRow>,
                  ...list.map((r) => (
                    <TableRow key={r.code}>
                      <TableCell className="font-medium">{r.display_name}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">{ruleRewardLabel(r)}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">{randLabel(r)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.conditions}
                        {r.daily_cap ? ` · max ${r.daily_cap}/day` : ''}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={r.admin_granted ? 'secondary' : 'outline'}>{r.admin_granted ? 'Admin' : 'Automatic'}</Badge>
                          {r.cap_category && <Badge variant="outline">Tier cap</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.is_active ? 'default' : 'outline'}>{r.is_active ? 'Active' : 'Off'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setEditing({ ...r })} aria-label={`Edit ${r.display_name}`}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )),
                ])}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.display_name}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              {editing.reward_kind === 'fixed' ? (
                <div className="space-y-2">
                  <Label htmlFor="rule-amount">Reward (UC)</Label>
                  <Input id="rule-amount" type="number" min={0} value={editing.reward_mg ?? ''}
                    onChange={(e) => setEditing({ ...editing, reward_mg: Number(e.target.value) })} />
                  <p className="text-xs text-muted-foreground">= {ucToRand(Number(editing.reward_mg) || 0)}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="rule-min">Minimum {editing.reward_kind === 'percent' ? '(%)' : '(UC)'}</Label>
                    <Input id="rule-min" type="number" min={0} value={editing.min_reward ?? ''}
                      onChange={(e) => setEditing({ ...editing, min_reward: num(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rule-max">Maximum {editing.reward_kind === 'percent' ? '(%)' : '(UC)'}</Label>
                    <Input id="rule-max" type="number" min={0} value={editing.max_reward ?? ''}
                      onChange={(e) => setEditing({ ...editing, max_reward: num(e.target.value) })} />
                  </div>
                  {editing.reward_kind === 'percent' && (
                    <p className="col-span-2 text-xs text-muted-foreground">
                      The rate actually paid comes from the user's tier (1% Starter to 3% Diamond); see Social Mining → Tiers.
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="rule-cap">Max times per day (blank = no limit)</Label>
                <Input id="rule-cap" type="number" min={1} value={editing.daily_cap ?? ''}
                  onChange={(e) => setEditing({ ...editing, daily_cap: num(e.target.value) })} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                Active (switch off to stop paying this reward)
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
