import { Loader2, Pickaxe } from 'lucide-react';
import { useSocialMining } from '@/hooks/useSocialMining';
import { useAuth } from '@/contexts/AuthContext';
import { AffiliateTierCard } from './AffiliateTierCard';
import { DailyMiningProgress } from './DailyMiningProgress';
import { SocialAccountConnector } from './SocialAccountConnector';
import { MiningTaskList } from './MiningTaskList';
import { MiningHistory } from './MiningHistory';
import { ReferralBonusInfo } from './ReferralBonusInfo';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export function SocialMiningDashboard() {
  const { user } = useAuth();
  const {
    isLoading,
    socialAccounts,
    affiliateStatus,
    miningTasks,
    completions,
    dailyLimit,
    connectSocialAccount,
    disconnectSocialAccount,
    completeTask,
    canCompleteTask,
    getTaskCompletionsToday,
    getNextTier,
    getTierProgress
  } = useSocialMining();

  if (!user) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Pickaxe className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Sign in to Start Mining</h3>
          <p className="text-muted-foreground mb-4">
            Connect your social accounts and earn UCoin through social mining!
          </p>
          <Button asChild>
            <Link to="/login">Sign In</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const miningMultiplier = affiliateStatus?.tier?.mining_multiplier || 1;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <AffiliateTierCard
          affiliateStatus={affiliateStatus}
          nextTier={getNextTier()}
          tierProgress={getTierProgress()}
        />
        <DailyMiningProgress dailyLimit={dailyLimit} />
      </div>

      {/* Social Accounts */}
      <SocialAccountConnector
        accounts={socialAccounts}
        onConnect={connectSocialAccount}
        onDisconnect={disconnectSocialAccount}
      />

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <MiningTaskList
            tasks={miningTasks}
            socialAccounts={socialAccounts}
            miningMultiplier={miningMultiplier}
            canCompleteTask={canCompleteTask}
            getCompletionsToday={getTaskCompletionsToday}
            onCompleteTask={completeTask}
          />
        </div>

        <div className="space-y-6">
          <ReferralBonusInfo />
          <MiningHistory completions={completions} />
        </div>
      </div>
    </div>
  );
}
