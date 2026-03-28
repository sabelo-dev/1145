import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign, TrendingUp, ShoppingCart, Eye, MousePointer,
  BarChart3, ArrowUpRight, ArrowDownRight, Target
} from 'lucide-react';
import type { Conversion, EngagementMetric, NormalizedPost } from '@/hooks/useInfluencerDashboard';
import { motion } from 'framer-motion';

interface MoneyViewProps {
  conversions: Conversion[];
  metrics: EngagementMetric[];
  posts: NormalizedPost[];
  stats: {
    totalEngagement: number;
    totalReach: number;
    totalClicks: number;
    totalRevenue: number;
    totalCommission: number;
    totalConversions: number;
    postCount: number;
  };
}

export const MoneyView: React.FC<MoneyViewProps> = ({
  conversions,
  metrics,
  posts,
  stats,
}) => {
  const conversionRate = stats.totalClicks > 0
    ? ((stats.totalConversions / stats.totalClicks) * 100).toFixed(1)
    : '0';

  const revenuePerPost = stats.postCount > 0
    ? (stats.totalRevenue / stats.postCount).toFixed(2)
    : '0';

  const engagementPerPost = stats.postCount > 0
    ? Math.round(stats.totalEngagement / stats.postCount)
    : 0;

  // Revenue by platform
  const revenueByPlatform: Record<string, number> = {};
  conversions.forEach(c => {
    revenueByPlatform[c.platform] = (revenueByPlatform[c.platform] || 0) + c.revenue;
  });

  // Top posts by conversions
  const postConversions: Record<string, { clicks: number; purchases: number; revenue: number }> = {};
  conversions.forEach(c => {
    if (!c.post_id) return;
    if (!postConversions[c.post_id]) {
      postConversions[c.post_id] = { clicks: 0, purchases: 0, revenue: 0 };
    }
    if (c.event_type === 'click') postConversions[c.post_id].clicks++;
    if (c.event_type === 'purchase') {
      postConversions[c.post_id].purchases++;
      postConversions[c.post_id].revenue += c.revenue;
    }
  });

  const topPosts = Object.entries(postConversions)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5)
    .map(([postId, data]) => ({
      post: posts.find(p => p.id === postId),
      ...data,
    }));

  const statCards = [
    {
      label: 'Total Revenue',
      value: `R${stats.totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      subtitle: `R${revenuePerPost}/post avg`,
    },
    {
      label: 'Commission Earned',
      value: `R${stats.totalCommission.toLocaleString()}`,
      icon: TrendingUp,
      color: 'text-primary',
      bg: 'bg-primary/10',
      subtitle: 'Your earnings',
    },
    {
      label: 'Conversions',
      value: stats.totalConversions.toString(),
      icon: ShoppingCart,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      subtitle: `${conversionRate}% rate`,
    },
    {
      label: 'Total Reach',
      value: stats.totalReach > 1000
        ? `${(stats.totalReach / 1000).toFixed(1)}K`
        : stats.totalReach.toString(),
      icon: Eye,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
      subtitle: `${stats.totalClicks.toLocaleString()} clicks`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-500" />
            Money View
          </h3>
          <p className="text-sm text-muted-foreground">Track your influence → revenue pipeline</p>
        </div>
      </div>

      {/* Revenue Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className={`p-2 rounded-lg ${stat.bg}`}>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold mt-2">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Conversion Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Conversion Funnel
          </CardTitle>
          <CardDescription>Post → Engagement → Clicks → Sales</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { label: 'Posts', value: stats.postCount, width: 100, color: 'bg-primary' },
              { label: 'Engagement', value: stats.totalEngagement, width: Math.min(80, stats.totalEngagement > 0 ? 80 : 0), color: 'bg-blue-500' },
              { label: 'Clicks', value: stats.totalClicks, width: Math.min(60, stats.totalClicks > 0 ? 60 : 0), color: 'bg-amber-500' },
              { label: 'Conversions', value: stats.totalConversions, width: Math.min(40, stats.totalConversions > 0 ? 40 : 0), color: 'bg-emerald-500' },
            ].map((step, i) => (
              <div key={step.label} className="flex items-center gap-3">
                <span className="text-sm w-24 text-muted-foreground">{step.label}</span>
                <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
                  <motion.div
                    className={`h-full ${step.color} rounded-full flex items-center justify-end pr-2`}
                    initial={{ width: 0 }}
                    animate={{ width: `${step.width}%` }}
                    transition={{ delay: i * 0.2, duration: 0.6 }}
                  >
                    <span className="text-xs font-medium text-white">
                      {step.value.toLocaleString()}
                    </span>
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Revenue by Platform */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue by Platform</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(revenueByPlatform).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No revenue data yet</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(revenueByPlatform)
                  .sort((a, b) => b[1] - a[1])
                  .map(([platform, revenue]) => (
                    <div key={platform} className="flex items-center justify-between">
                      <span className="capitalize text-sm">{platform}</span>
                      <span className="font-medium text-sm">R{revenue.toLocaleString()}</span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Converting Posts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Converting Posts</CardTitle>
          </CardHeader>
          <CardContent>
            {topPosts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Link products to posts to track conversions
              </p>
            ) : (
              <div className="space-y-3">
                {topPosts.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground w-6">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">
                        {item.post?.caption?.slice(0, 40) || 'Untitled post'}
                      </p>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>{item.clicks} clicks</span>
                        <span>{item.purchases} sales</span>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-emerald-500">
                      R{item.revenue.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
