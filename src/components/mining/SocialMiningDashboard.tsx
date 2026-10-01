import { Loader2, Pickaxe } from 'lucide-react';
import { useSocialMining } from '@/hooks/useSocialMining';
import { useAuth } from '@/contexts/AuthContext';
import { AffiliateTierCard } from './AffiliateTierCard';
import { DailyMiningProgress } from './DailyMiningProgress';
import { SocialAccountConnector } from './SocialAccountConnector';
import { MiningTaskList } from './MiningTaskList';
import { MiningHistory } from './MiningHistory';
import { ReferralBonusInfo } from './ReferralBonusInfo';
import { MiningRules } from './MiningRules';
import { DailyCheckInCard } from './DailyCheckInCard';
import { MiningCapacityCard, type MiningCapacityHandle } from './MiningCapacityCard';
import { TierPlans } from './TierPlans';
import { useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface SocialMiningDashboardProps {
  /** Called after a task is completed and its reward credited. */
  onTaskCompleted?: () => void;
}

export function SocialMiningDashboard({ onTaskCompleted }: SocialMiningDashboardProps = {}) {
  const { user } = useAuth();
  const capacityRef = useRef<MiningCapacityHandle>(null);
  // Anything earned here changes today's capacity and the wallet.
  const handleEarned = () => {
    capacityRef.current?.refresh();
    onTaskCompleted?.();
  };
  const {
    isLoading,
    socialAccounts,
    affiliateStatus,
    affiliateTiers,
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
          <h3 className="text-lg font-semibold mb-2">Sign in to Start Earning</h3>
          <p className="text-muted-foreground mb-4">
            Connect your social accounts and earn UCoin rewards!
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
      <div className="grid gap-4 md:grid-cols-2">
        <DailyCheckInCard onEarned={handleEarned} />
        <MiningCapacityCard ref={capacityRef} />
      </div>

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
            onCompleteTask={async (taskId, proofUrl, socialAccountId) => {
              const result = await completeTask(taskId, proofUrl, socialAccountId);
              if (result) handleEarned();
              return result;
            }}
            onConnectAccount={connectSocialAccount}
          />
        </div>

        <div className="space-y-6">
          <ReferralBonusInfo />
          <MiningHistory completions={completions} />
        </div>
      </div>

      <TierPlans
        currentLevel={affiliateStatus?.tier?.level ?? 1}
        qualifiedReferrals={affiliateStatus?.total_conversions ?? 0}
      />

      {/* Mining rules */}
      <MiningRules
        tiers={affiliateTiers}
        tasks={miningTasks}
        affiliateStatus={affiliateStatus}
      />
    </div>
  );
}
