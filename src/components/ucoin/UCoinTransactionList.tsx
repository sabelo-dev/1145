import { format } from 'date-fns';
import { ArrowUpRight, ArrowDownRight, Coins } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UCoinTransaction } from '@/types/ucoin';
import { Skeleton } from '@/components/ui/skeleton';

interface UCoinTransactionListProps {
  transactions: UCoinTransaction[];
  isLoading?: boolean;
}

const categoryLabels: Record<string, string> = {
  order_completed: 'Order Completed',
  delivery_completed: 'Delivery Completed',
  review_submitted: 'Review Submitted',
  referral_signup: 'Referral Signup',
  referral_purchase: 'Referral Purchase',
  ontime_delivery: 'On-Time Delivery',
  sales_milestone_100: '100 Sales Milestone',
  sales_milestone_500: '500 Sales Milestone',
  sales_milestone_1000: '1000 Sales Milestone',
  daily_login: 'Daily Login',
  profile_complete: 'Profile Complete',
  discount_5_percent: '5% Discount',
  discount_10_percent: '10% Discount',
  free_delivery: 'Free Delivery',
  delivery_discount: 'Delivery Discount',
  ad_boost_basic: 'Basic Ad Boost',
  ad_boost_premium: 'Premium Ad Boost',
  priority_listing: 'Priority Listing',
  cashout_driver: 'Cash Out',
  cashout_vendor: 'Cash Out'
};

export function UCoinTransactionList({ transactions, isLoading }: UCoinTransactionListProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-500" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div>
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-500" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Coins className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No transactions yet</p>
            <p className="text-sm">Start earning UCoin by completing orders and engaging with the platform!</p>
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
          Transaction History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-full ${
                      tx.type === 'earn'
                        ? 'bg-green-100 dark:bg-green-900/30'
                        : 'bg-orange-100 dark:bg-orange-900/30'
                    }`}
                  >
                    {tx.type === 'earn' ? (
                      <ArrowUpRight className="h-4 w-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {categoryLabels[tx.category] || tx.category.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(tx.created_at), 'MMM d, yyyy • h:mm a')}
                    </p>
                  </div>
                </div>
                <div
                  className={`font-semibold ${
                    tx.type === 'earn'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-orange-600 dark:text-orange-400'
                  }`}
                >
                  {tx.type === 'earn' ? '+' : '-'}{tx.amount.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
