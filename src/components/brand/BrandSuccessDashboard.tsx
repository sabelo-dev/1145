import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Star, Truck, Users, 
  Target, Clock, BarChart3, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { BrandPerformance, BrandTier } from '@/types/brand';
import { cn } from '@/lib/utils';

interface BrandSuccessDashboardProps {
  performance: BrandPerformance | null;
  tier: BrandTier | null;
  previousPerformance?: BrandPerformance | null;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ElementType;
  color: string;
  suffix?: string;
  tooltip?: string;
}

function MetricCard({ title, value, change, icon: Icon, color, suffix = '', tooltip }: MetricCardProps) {
  const isPositive = change !== undefined && change >= 0;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className={cn("p-2 rounded-lg", color)}>
                  <Icon className="h-4 w-4" />
                </div>
                {change !== undefined && (
                  <div className={cn(
                    "flex items-center text-xs font-medium",
                    isPositive ? "text-green-600" : "text-red-600"
                  )}>
                    {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(change).toFixed(1)}%
                  </div>
                )}
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold">{value}{suffix}</p>
                <p className="text-sm text-muted-foreground">{title}</p>
              </div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        {tooltip && (
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

export function BrandSuccessDashboard({ performance, tier, previousPerformance }: BrandSuccessDashboardProps) {
  const calculateChange = (current: number | null, previous: number | null) => {
    if (current === null || previous === null || previous === 0) return undefined;
    return ((current - previous) / previous) * 100;
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `R${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `R${(value / 1000).toFixed(1)}K`;
    return `R${value.toFixed(0)}`;
  };

  if (!performance) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No performance data available yet.</p>
          <p className="text-sm mt-2">Complete some orders to see your metrics.</p>
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    {
      title: 'Total Revenue',
      value: formatCurrency(performance.total_revenue),
      change: calculateChange(performance.total_revenue, previousPerformance?.total_revenue || null),
      icon: DollarSign,
      color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
      tooltip: 'Total sales revenue for this period'
    },
    {
      title: 'Total Orders',
      value: performance.total_orders,
      change: calculateChange(performance.total_orders, previousPerformance?.total_orders || null),
      icon: ShoppingCart,
      color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
      tooltip: 'Number of orders received'
    },
    {
      title: 'Avg Rating',
      value: performance.average_rating?.toFixed(1) || 'N/A',
      change: calculateChange(performance.average_rating, previousPerformance?.average_rating || null),
      icon: Star,
      color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
      suffix: performance.average_rating ? '/5' : '',
      tooltip: 'Average customer rating'
    },
    {
      title: 'Fulfillment Rate',
      value: performance.fulfillment_rate?.toFixed(0) || 'N/A',
      change: calculateChange(performance.fulfillment_rate, previousPerformance?.fulfillment_rate || null),
      icon: Truck,
      color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
      suffix: performance.fulfillment_rate ? '%' : '',
      tooltip: 'Percentage of orders fulfilled on time'
    },
    {
      title: 'Conversion Rate',
      value: performance.conversion_rate?.toFixed(1) || 'N/A',
      change: calculateChange(performance.conversion_rate, previousPerformance?.conversion_rate || null),
      icon: Target,
      color: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
      suffix: performance.conversion_rate ? '%' : '',
      tooltip: 'Views that converted to purchases'
    },
    {
      title: 'Repeat Customers',
      value: performance.repeat_customer_rate?.toFixed(0) || 'N/A',
      change: calculateChange(performance.repeat_customer_rate, previousPerformance?.repeat_customer_rate || null),
      icon: Users,
      color: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
      suffix: performance.repeat_customer_rate ? '%' : '',
      tooltip: 'Percentage of returning customers'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Tier Badge */}
      {tier && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: tier.badge_color }}
            >
              {tier.display_name[0]}
            </div>
            <div>
              <h3 className="font-semibold">{tier.display_name} Tier</h3>
              <p className="text-sm text-muted-foreground">
                {tier.commission_rate}% commission • {tier.payout_days}-day payouts
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="text-sm">
            {tier.promo_credits_monthly} credits/month
          </Badge>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </div>

      {/* Order Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Order Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Completed</span>
              <div className="flex items-center gap-2">
                <Progress 
                  value={(performance.completed_orders / Math.max(performance.total_orders, 1)) * 100} 
                  className="w-32 h-2"
                />
                <span className="text-sm font-medium w-12 text-right">{performance.completed_orders}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Cancelled</span>
              <div className="flex items-center gap-2">
                <Progress 
                  value={(performance.cancelled_orders / Math.max(performance.total_orders, 1)) * 100} 
                  className="w-32 h-2 [&>div]:bg-red-500"
                />
                <span className="text-sm font-medium w-12 text-right">{performance.cancelled_orders}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Returned</span>
              <div className="flex items-center gap-2">
                <Progress 
                  value={(performance.returned_orders / Math.max(performance.total_orders, 1)) * 100} 
                  className="w-32 h-2 [&>div]:bg-amber-500"
                />
                <span className="text-sm font-medium w-12 text-right">{performance.returned_orders}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Review Sentiment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customer Sentiment</CardTitle>
          <CardDescription>Based on {performance.total_reviews} reviews</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" /> Positive
                </span>
                <span className="text-sm font-medium">{performance.positive_reviews}</span>
              </div>
              <Progress 
                value={(performance.positive_reviews / Math.max(performance.total_reviews, 1)) * 100}
                className="h-3 [&>div]:bg-green-500"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-red-600 flex items-center gap-1">
                  <TrendingDown className="h-4 w-4" /> Negative
                </span>
                <span className="text-sm font-medium">{performance.negative_reviews}</span>
              </div>
              <Progress 
                value={(performance.negative_reviews / Math.max(performance.total_reviews, 1)) * 100}
                className="h-3 [&>div]:bg-red-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
