import { useCallback, useEffect, useImperativeHandle, useState, forwardRef } from 'react';
import { Gauge } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { callRewardRpc, ucToRand } from '@/lib/ucRewards';

interface Capacity {
  tier: { name: string; level: number; daily_cap: number; monthly_cap: number | null; base_mining: number; cashback_percent: number };
  today: number;
  last_30_days: number;
  remaining: number;
  by_category: Record<string, number>;
  qualified_referrals: number;
}

// Everyday earnings that count towards the tier caps (cap_category).
const CATEGORIES: [string, string][] = [
  ['base', 'Base mining'],
  ['checkin', 'Daily check-in'],
  ['browse', 'Browse/shop activity'],
  ['purchase', 'Completed purchase'],
  ['ride', 'Completed ride'],
  ['task', 'Completed task'],
  ['referral', 'Referral activity'],
];

export interface MiningCapacityHandle { refresh: () => void }

/** "GOLD MINING CAPACITY 500 UC/day" breakdown of today's capped earnings. */
export const MiningCapacityCard = forwardRef<MiningCapacityHandle>(function MiningCapacityCard(_, ref) {
  const [cap, setCap] = useState<Capacity | null>(null);

  const load = useCallback(() => {
    callRewardRpc<Capacity>('uc_capacity').then(setCap).catch(() => setCap(null));
  }, []);
  useEffect(() => { load(); }, [load]);
  useImperativeHandle(ref, () => ({ refresh: load }), [load]);

  if (!cap) return null;

  const today = Number(cap.today);
  const daily = Number(cap.tier.daily_cap);
  const monthly = Number(cap.tier.monthly_cap ?? daily * 30);
  const unused = Math.max(0, daily - today);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold tracking-wide uppercase flex items-center gap-2">
          <Gauge className="h-4 w-4" />
          {cap.tier.name} mining capacity
        </CardTitle>
        <p className="text-2xl font-bold tabular-nums">{daily.toLocaleString()} UC/day</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="font-mono text-sm space-y-1">
          {CATEGORIES.map(([key, label]) => (
            <div key={key} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="tabular-nums">{Number(cap.by_category[key] ?? 0)} UC</dd>
            </div>
          ))}
          <div className="border-t pt-1 flex justify-between gap-4 font-semibold">
            <dt>Earned today</dt>
            <dd className="tabular-nums">{today} UC</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Unused capacity</dt>
            <dd className="tabular-nums">{unused} UC</dd>
          </div>
        </dl>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Last 30 days</span>
            <span className="tabular-nums">
              {Number(cap.last_30_days).toLocaleString()} / {monthly.toLocaleString()} UC ({ucToRand(monthly)})
            </span>
          </div>
          <Progress value={Math.min(100, (Number(cap.last_30_days) / Math.max(monthly, 1)) * 100)} className="h-2" />
        </div>
        <p className="text-xs text-muted-foreground">
          One-off bonuses (welcome, first purchase, milestones, birthday) don't count towards these limits.
        </p>
      </CardContent>
    </Card>
  );
});
