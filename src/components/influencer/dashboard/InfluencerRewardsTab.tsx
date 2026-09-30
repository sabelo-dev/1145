import React from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Coins, Wallet, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUCoin } from '@/hooks/useUCoin';
import { SocialMiningDashboard } from '@/components/mining/SocialMiningDashboard';

/**
 * Tasks + the UCoin wallet they pay into. Completing a task credits the
 * wallet server-side (complete_mining_task → ucoin_wallets / ucoin_transactions),
 * so the balance here is refreshed from the database after each completion.
 */
export const InfluencerRewardsTab: React.FC = () => {
  const { wallet, transactions, isLoading, refreshWallet, refreshTransactions } = useUCoin();

  const taskRewards = transactions.filter((t) => t.type === 'earn' && t.category === 'social_mining').slice(0, 5);

  const refresh = () => {
    refreshWallet();
    refreshTransactions();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Wallet className="h-5 w-5" />
              UCoin wallet
            </CardTitle>
            <CardDescription>Task rewards are credited here instantly</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/wallet">
              Open wallet
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-primary/10 p-4">
            <p className="text-xs text-muted-foreground">Balance</p>
            <p className="text-2xl font-bold tabular-nums">
              {isLoading ? '…' : Number(wallet?.balance ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Lifetime earned {Number(wallet?.lifetime_earned ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="md:col-span-2">
            <p className="text-sm font-medium mb-2">Recent task rewards</p>
            {taskRewards.length === 0 ? (
              <p className="text-sm text-muted-foreground">No task rewards yet. Complete a task below to earn UCoin.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {taskRewards.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      <Coins className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate">{t.description || 'Mining reward'}</span>
                    </span>
                    <span className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                      </span>
                      <span className="font-semibold text-green-600 tabular-nums">+{t.amount}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <SocialMiningDashboard onTaskCompleted={refresh} />
    </div>
  );
};
