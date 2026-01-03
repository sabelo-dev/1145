import { Pickaxe, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { DailyMiningLimit } from '@/hooks/useSocialMining';

interface DailyMiningProgressProps {
  dailyLimit: DailyMiningLimit | null;
}

export function DailyMiningProgress({ dailyLimit }: DailyMiningProgressProps) {
  if (!dailyLimit) return null;

  const isAtLimit = dailyLimit.remaining <= 0;

  return (
    <Card className={isAtLimit ? 'border-yellow-500/50' : ''}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Pickaxe className="h-5 w-5" />
          Today's Mining
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold">{dailyLimit.total_mined}</p>
            <p className="text-sm text-muted-foreground">
              of {dailyLimit.daily_cap} UCoin mined
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-sm">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span className="font-medium">{dailyLimit.tasks_completed}</span>
            </div>
            <p className="text-xs text-muted-foreground">tasks done</p>
          </div>
        </div>

        <Progress 
          value={dailyLimit.percentage} 
          className="h-3"
        />

        {isAtLimit ? (
          <p className="text-sm text-yellow-600 dark:text-yellow-400 text-center">
            Daily limit reached! Come back tomorrow for more mining.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground text-center">
            {dailyLimit.remaining} UCoin remaining today
          </p>
        )}
      </CardContent>
    </Card>
  );
}
