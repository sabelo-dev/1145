import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DollarSign,
  MapPin,
  Zap,
  TrendingUp,
  Gift,
  Star,
  Clock,
} from 'lucide-react';
import type { DeliveryEarnings } from '@/types/driver';

interface DriverEarningsBreakdownProps {
  earnings: DeliveryEarnings[];
  totalEarnings: number;
  availableBalance: number;
  pendingTips: number;
}

const DriverEarningsBreakdown: React.FC<DriverEarningsBreakdownProps> = ({
  earnings,
  totalEarnings,
  availableBalance,
  pendingTips,
}) => {
  // Calculate totals from recent earnings
  const recentEarnings = earnings.slice(0, 20);
  const totals = recentEarnings.reduce(
    (acc, e) => ({
      base: acc.base + e.base_pay,
      distance: acc.distance + e.distance_pay,
      urgency: acc.urgency + e.urgency_pay,
      surge: acc.surge + e.surge_pay,
      tips: acc.tips + e.tip_amount,
      tierBonus: acc.tierBonus + e.tier_bonus,
      total: acc.total + e.total_earnings,
    }),
    { base: 0, distance: 0, urgency: 0, surge: 0, tips: 0, tierBonus: 0, total: 0 }
  );

  const breakdownItems = [
    { label: 'Base Pay', value: totals.base, icon: DollarSign, color: 'text-green-500' },
    { label: 'Distance Pay', value: totals.distance, icon: MapPin, color: 'text-blue-500' },
    { label: 'Urgency Bonus', value: totals.urgency, icon: Zap, color: 'text-amber-500' },
    { label: 'Surge Pay', value: totals.surge, icon: TrendingUp, color: 'text-red-500' },
    { label: 'Tips', value: totals.tips, icon: Gift, color: 'text-purple-500' },
    { label: 'Tier Bonus', value: totals.tierBonus, icon: Star, color: 'text-primary' },
  ];

  return (
    <div className="space-y-6">
      {/* Balance Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/10">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Available Balance</p>
                <p className="text-2xl font-bold">R{availableBalance.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Earned</p>
                <p className="text-2xl font-bold">R{totalEarnings.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-purple-500/10">
                <Gift className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Tips</p>
                <p className="text-2xl font-bold">R{pendingTips.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Earnings Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Earnings Breakdown</CardTitle>
          <CardDescription>Your earnings from the last 20 deliveries</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {breakdownItems.map((item) => {
              const percentage = totals.total > 0 ? (item.value / totals.total) * 100 : 0;
              return (
                <div key={item.label} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <item.icon className={`h-4 w-4 ${item.color}`} />
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold">R{item.value.toFixed(2)}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Total (Last 20 Deliveries)</span>
              <span className="text-xl font-bold text-primary">R{totals.total.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Earnings List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Earnings</CardTitle>
          <CardDescription>Detailed view of your recent deliveries</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentEarnings.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No earnings yet. Complete deliveries to see your earnings here.
              </p>
            ) : (
              recentEarnings.map((earning) => (
                <div
                  key={earning.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <Clock className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Delivery</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(earning.created_at).toLocaleDateString()} •{' '}
                        {earning.distance_km?.toFixed(1) || '0'} km
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">R{earning.total_earnings.toFixed(2)}</p>
                    <div className="flex gap-1 mt-1">
                      {earning.surge_multiplier && earning.surge_multiplier > 1 && (
                        <Badge variant="outline" className="text-xs">
                          {earning.surge_multiplier}x Surge
                        </Badge>
                      )}
                      {earning.tip_amount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          +R{earning.tip_amount} Tip
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DriverEarningsBreakdown;
