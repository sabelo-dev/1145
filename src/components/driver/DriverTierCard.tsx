import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Trophy,
  Star,
  Clock,
  Shield,
  Wallet,
  ChevronRight,
  Check,
  Lock,
} from 'lucide-react';
import type { DriverTier } from '@/types/driver';

interface DriverTierCardProps {
  currentTier: DriverTier | null;
  allTiers: DriverTier[];
  driverStats?: {
    total_deliveries: number;
    ontime_rate: number;
    acceptance_rate: number;
    rating: number;
  };
}

const DriverTierCard: React.FC<DriverTierCardProps> = ({
  currentTier,
  allTiers,
  driverStats,
}) => {
  const stats = driverStats || {
    total_deliveries: 0,
    ontime_rate: 100,
    acceptance_rate: 100,
    rating: 5.0,
  };

  const nextTier = allTiers.find((t) => t.level === (currentTier?.level || 0) + 1);

  const getProgressToNextTier = () => {
    if (!nextTier) return 100;
    
    const deliveryProgress = (stats.total_deliveries / nextTier.min_deliveries) * 100;
    const ontimeProgress = (stats.ontime_rate / nextTier.min_ontime_rate) * 100;
    const acceptanceProgress = (stats.acceptance_rate / nextTier.min_acceptance_rate) * 100;
    const ratingProgress = (stats.rating / nextTier.min_rating) * 100;
    
    return Math.min((deliveryProgress + ontimeProgress + acceptanceProgress + ratingProgress) / 4, 100);
  };

  const getTierIcon = (level: number) => {
    switch (level) {
      case 1:
        return '🚗';
      case 2:
        return '⚡';
      case 3:
        return '🌟';
      case 4:
        return '👑';
      default:
        return '🚗';
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Tier Card */}
      <Card className="overflow-hidden">
        <div
          className="h-2"
          style={{ backgroundColor: currentTier?.badge_color || '#6B7280' }}
        />
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-4xl">{getTierIcon(currentTier?.level || 1)}</div>
              <div>
                <CardTitle className="text-xl">
                  {currentTier?.display_name || 'Rookie'}
                </CardTitle>
                <CardDescription>Your current driver level</CardDescription>
              </div>
            </div>
            <Badge
              style={{ backgroundColor: currentTier?.badge_color || '#6B7280' }}
              className="text-white"
            >
              Level {currentTier?.level || 1}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Tier Benefits */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <Wallet className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-xs text-muted-foreground">Pay Multiplier</p>
              <p className="font-bold">{currentTier?.base_pay_multiplier || 1}x</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <Clock className="h-5 w-5 mx-auto mb-1 text-amber-500" />
              <p className="text-xs text-muted-foreground">Cashout Fee</p>
              <p className="font-bold">{currentTier?.cashout_fee_percent || 5}%</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <Shield className="h-5 w-5 mx-auto mb-1 text-green-500" />
              <p className="text-xs text-muted-foreground">Insurance</p>
              <p className="font-bold">{currentTier?.insurance_coverage_percent || 0}%</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <Star className="h-5 w-5 mx-auto mb-1 text-purple-500" />
              <p className="text-xs text-muted-foreground">Priority Access</p>
              <p className="font-bold">{currentTier?.priority_job_access ? 'Yes' : 'No'}</p>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Tier Benefits:</p>
            <div className="grid grid-cols-2 gap-2">
              {(currentTier?.features as string[] || []).map((feature, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Progress to Next Tier */}
          {nextTier && (
            <div className="mt-6 pt-4 border-t">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Progress to {nextTier.display_name}</span>
                <span className="text-sm text-muted-foreground">
                  {getProgressToNextTier().toFixed(0)}%
                </span>
              </div>
              <Progress value={getProgressToNextTier()} className="h-2" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
                <div className="text-center">
                  <p className="text-muted-foreground">Deliveries</p>
                  <p className="font-medium">
                    {stats.total_deliveries}/{nextTier.min_deliveries}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground">On-Time</p>
                  <p className="font-medium">
                    {stats.ontime_rate}%/{nextTier.min_ontime_rate}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground">Acceptance</p>
                  <p className="font-medium">
                    {stats.acceptance_rate}%/{nextTier.min_acceptance_rate}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground">Rating</p>
                  <p className="font-medium">
                    {stats.rating.toFixed(1)}/{nextTier.min_rating}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Tiers Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Driver Levels
          </CardTitle>
          <CardDescription>Unlock better rewards as you progress</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {allTiers.map((tier) => {
              const isUnlocked = (currentTier?.level || 0) >= tier.level;
              const isCurrent = currentTier?.level === tier.level;

              return (
                <div
                  key={tier.id}
                  className={`p-4 rounded-lg border transition-all ${
                    isCurrent
                      ? 'border-primary bg-primary/5'
                      : isUnlocked
                      ? 'border-green-500/50 bg-green-500/5'
                      : 'border-muted bg-muted/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{getTierIcon(tier.level)}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{tier.display_name}</h4>
                          {isCurrent && (
                            <Badge variant="outline" className="text-xs">
                              Current
                            </Badge>
                          )}
                          {!isUnlocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {tier.min_deliveries}+ deliveries • {tier.min_rating}+ rating
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{tier.base_pay_multiplier}x pay</p>
                      <p className="text-xs text-muted-foreground">
                        {tier.cashout_fee_percent}% fee
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DriverTierCard;
