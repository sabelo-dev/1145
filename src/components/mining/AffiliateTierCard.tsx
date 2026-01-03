import { Sprout, TrendingUp, Users, Crown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AffiliateTier, UserAffiliateStatus } from '@/hooks/useSocialMining';

const tierIcons: Record<string, React.ElementType> = {
  Sprout,
  TrendingUp,
  Users,
  Crown
};

interface AffiliateTierCardProps {
  affiliateStatus: UserAffiliateStatus | null;
  nextTier: AffiliateTier | null;
  tierProgress: number;
}

export function AffiliateTierCard({ affiliateStatus, nextTier, tierProgress }: AffiliateTierCardProps) {
  const currentTier = affiliateStatus?.tier;
  const TierIcon = currentTier?.badge_icon ? tierIcons[currentTier.badge_icon] || Sprout : Sprout;
  const NextIcon = nextTier?.badge_icon ? tierIcons[nextTier.badge_icon] || TrendingUp : TrendingUp;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Affiliate Tier</span>
          {currentTier && (
            <Badge 
              style={{ backgroundColor: currentTier.badge_color }}
              className="text-white"
            >
              <TierIcon className="h-3 w-3 mr-1" />
              {currentTier.display_name}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{affiliateStatus?.total_conversions || 0}</p>
            <p className="text-xs text-muted-foreground">Conversions</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{affiliateStatus?.total_referrals || 0}</p>
            <p className="text-xs text-muted-foreground">Referrals</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{currentTier?.mining_multiplier || 1}×</p>
            <p className="text-xs text-muted-foreground">Multiplier</p>
          </div>
        </div>

        {nextTier && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <TierIcon className="h-4 w-4" style={{ color: currentTier?.badge_color }} />
                <span>{currentTier?.display_name}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <NextIcon className="h-4 w-4" style={{ color: nextTier.badge_color }} />
                <span>{nextTier.display_name}</span>
              </div>
            </div>
            <Progress value={tierProgress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {nextTier.min_conversions - (affiliateStatus?.total_conversions || 0)} conversions to next tier
            </p>
          </div>
        )}

        <div className="pt-2 border-t">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Daily Mining Cap</span>
            <span className="font-medium">{currentTier?.daily_mining_cap || 20} UCoin</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
