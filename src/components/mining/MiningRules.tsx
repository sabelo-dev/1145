import { ScrollText, Zap, ShieldCheck, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AffiliateTier, MiningTask, UserAffiliateStatus } from '@/hooks/useSocialMining';

interface MiningRulesProps {
  tiers: AffiliateTier[];
  tasks: MiningTask[];
  affiliateStatus: UserAffiliateStatus | null;
}

export function MiningRules({ tiers, tasks, affiliateStatus }: MiningRulesProps) {
  const currentTierId = affiliateStatus?.tier?.id;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-primary" />
            How mining works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Every completed task pays UCoin straight into your wallet. 1 UCoin = 1mg of gold.
          </p>
          <ul className="space-y-2 list-disc pl-5">
            <li>Your reward is the task reward multiplied by your level bonus.</li>
            <li>Each task has a cooldown and a maximum number of times per day.</li>
            <li>Your level sets a daily earning cap. Once you hit it, mining pauses until tomorrow.</li>
            <li>Rewards are credited instantly and appear in your UCoin history.</li>
            <li>You earn a bonus when people you referred mine: 10% from level 1, 3% from level 2, 1% from level 3.</li>
            <li>Tasks that name a platform need that account connected first.</li>
            <li>Fake, duplicate or removed posts are rejected and can suspend mining.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-gold" />
            Levels &amp; daily caps
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 ${
                  tier.id === currentTierId ? 'border-primary bg-primary/5' : ''
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{tier.display_name}</span>
                    {tier.id === currentTierId && <Badge variant="secondary">You</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tier.min_conversions === 0
                      ? 'Starting level'
                      : `${tier.min_conversions}+ referred customers`}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline">{tier.mining_multiplier}x rewards</Badge>
                  <Badge variant="outline">{tier.daily_mining_cap} UCoin/day</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Task rewards
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {tasks.map((task) => (
              <div key={task.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {task.cooldown_hours}h cooldown &middot; up to {task.max_daily_completions}x per day
                    {task.min_followers > 0 ? ` · ${task.min_followers}+ followers` : ''}
                  </p>
                </div>
                <Badge variant="secondary">+{task.base_reward} UCoin</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Fair play
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ul className="space-y-2 list-disc pl-5">
            <li>One account per person and per social profile.</li>
            <li>Posts must stay live for at least 24 hours.</li>
            <li>Bought engagement, bots or misleading claims about 1145 are not allowed.</li>
            <li>We may review any completion and reverse rewards found to be fake.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
