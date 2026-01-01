import { Coins, ShoppingBag, Truck, Star, Users, Clock, Trophy, Zap, UserCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BiGoldEarningRule } from '@/types/bigold';
import { Skeleton } from '@/components/ui/skeleton';

interface BiGoldEarningGuideProps {
  rules: BiGoldEarningRule[];
  isLoading?: boolean;
}

const categoryIcons: Record<string, React.ReactNode> = {
  order_completed: <ShoppingBag className="h-4 w-4" />,
  delivery_completed: <Truck className="h-4 w-4" />,
  review_submitted: <Star className="h-4 w-4" />,
  referral_signup: <Users className="h-4 w-4" />,
  referral_purchase: <Users className="h-4 w-4" />,
  ontime_delivery: <Clock className="h-4 w-4" />,
  sales_milestone_100: <Trophy className="h-4 w-4" />,
  sales_milestone_500: <Trophy className="h-4 w-4" />,
  sales_milestone_1000: <Trophy className="h-4 w-4" />,
  daily_login: <Zap className="h-4 w-4" />,
  profile_complete: <UserCheck className="h-4 w-4" />
};

export function BiGoldEarningGuide({ rules, isLoading }: BiGoldEarningGuideProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-500" />
            Ways to Earn BiGold
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-amber-500" />
          Ways to Earn BiGold
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                  {categoryIcons[rule.category] || <Coins className="h-4 w-4" />}
                </div>
                <span className="text-sm font-medium">{rule.description}</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-yellow-500 to-amber-500 text-white text-sm font-semibold">
                <Coins className="h-3 w-3" />
                +{(rule.amount * rule.multiplier).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
