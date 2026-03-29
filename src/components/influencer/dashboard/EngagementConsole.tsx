import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Heart, MessageCircle, Share2, Eye, MousePointer, Bookmark,
  TrendingUp, BarChart3, Activity
} from 'lucide-react';
import type { EngagementMetric } from '@/hooks/useInfluencerDashboard';
import { motion } from 'framer-motion';
import { format, subDays } from 'date-fns';

interface EngagementConsoleProps {
  metrics: EngagementMetric[];
  stats: {
    totalEngagement: number;
    totalReach: number;
    totalClicks: number;
    postCount: number;
  };
}

export const EngagementConsole: React.FC<EngagementConsoleProps> = ({ metrics, stats }) => {
  // Aggregate by date for last 14 days
  const last14Days = Array.from({ length: 14 }, (_, i) => {
    const date = format(subDays(new Date(), 13 - i), 'yyyy-MM-dd');
    const dayMetrics = metrics.filter(m => m.metric_date === date);
    return {
      date,
      label: format(subDays(new Date(), 13 - i), 'MMM d'),
      likes: dayMetrics.reduce((s, m) => s + m.likes, 0),
      comments: dayMetrics.reduce((s, m) => s + m.comments, 0),
      shares: dayMetrics.reduce((s, m) => s + m.shares, 0),
      reach: dayMetrics.reduce((s, m) => s + m.reach, 0),
      clicks: dayMetrics.reduce((s, m) => s + m.clicks, 0),
    };
  });

  const maxEngagement = Math.max(...last14Days.map(d => d.likes + d.comments + d.shares), 1);

  // Platform breakdown
  const platformBreakdown: Record<string, { likes: number; comments: number; shares: number; reach: number }> = {};
  metrics.forEach(m => {
    if (!platformBreakdown[m.platform]) {
      platformBreakdown[m.platform] = { likes: 0, comments: 0, shares: 0, reach: 0 };
    }
    platformBreakdown[m.platform].likes += m.likes;
    platformBreakdown[m.platform].comments += m.comments;
    platformBreakdown[m.platform].shares += m.shares;
    platformBreakdown[m.platform].reach += m.reach;
  });

  const avgEngagementRate = metrics.length > 0
    ? (metrics.reduce((s, m) => s + m.engagement_rate, 0) / metrics.length).toFixed(2)
    : '0';

  const metricCards = [
    { icon: Heart, label: 'Total Likes', value: metrics.reduce((s, m) => s + m.likes, 0), color: 'text-red-500' },
    { icon: MessageCircle, label: 'Total Comments', value: metrics.reduce((s, m) => s + m.comments, 0), color: 'text-blue-500' },
    { icon: Share2, label: 'Total Shares', value: metrics.reduce((s, m) => s + m.shares, 0), color: 'text-green-500' },
    { icon: Bookmark, label: 'Total Saves', value: metrics.reduce((s, m) => s + m.saves, 0), color: 'text-purple-500' },
    { icon: Eye, label: 'Impressions', value: metrics.reduce((s, m) => s + m.impressions, 0), color: 'text-amber-500' },
    { icon: Activity, label: 'Engagement Rate', value: `${avgEngagementRate}%`, color: 'text-primary' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Engagement Console
        </h3>
        <p className="text-sm text-muted-foreground">Deep-dive into your content performance</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {metricCards.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card>
              <CardContent className="p-3 text-center">
                <m.icon className={`h-5 w-5 mx-auto mb-1 ${m.color}`} />
                <p className="text-lg font-bold">
                  {typeof m.value === 'number' ? m.value.toLocaleString() : m.value}
                </p>
                <p className="text-[10px] text-muted-foreground">{m.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Engagement Chart (CSS-based bar chart) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">14-Day Engagement Trend</CardTitle>
          <CardDescription>Daily likes, comments, and shares</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-32">
            {last14Days.map((day, i) => {
              const total = day.likes + day.comments + day.shares;
              const height = (total / maxEngagement) * 100;
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center group relative">
                  <motion.div
                    className="w-full bg-primary/80 rounded-t hover:bg-primary transition-colors cursor-pointer"
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(height, 2)}%` }}
                    transition={{ delay: i * 0.03, duration: 0.4 }}
                  />
                  <span className="text-[9px] text-muted-foreground mt-1 rotate-[-45deg] origin-top-left whitespace-nowrap">
                    {day.label}
                  </span>
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-1 hidden group-hover:block bg-popover text-popover-foreground text-xs p-2 rounded shadow-lg z-10 whitespace-nowrap">
                    <p className="font-medium">{day.label}</p>
                    <p>❤️ {day.likes} 💬 {day.comments} 🔗 {day.shares}</p>
                    <p>👁 {day.reach.toLocaleString()} reach</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Platform Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(platformBreakdown).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No engagement data yet</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(platformBreakdown).map(([platform, data]) => {
                const total = data.likes + data.comments + data.shares;
                return (
                  <div key={platform} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium capitalize">{platform}</span>
                      <span className="text-sm text-muted-foreground">{total.toLocaleString()} total</span>
                    </div>
                    <div className="flex gap-1 h-2">
                      <div
                        className="bg-red-400 rounded-l"
                        style={{ width: `${total > 0 ? (data.likes / total) * 100 : 0}%` }}
                        title={`Likes: ${data.likes}`}
                      />
                      <div
                        className="bg-blue-400"
                        style={{ width: `${total > 0 ? (data.comments / total) * 100 : 0}%` }}
                        title={`Comments: ${data.comments}`}
                      />
                      <div
                        className="bg-green-400 rounded-r"
                        style={{ width: `${total > 0 ? (data.shares / total) * 100 : 0}%` }}
                        title={`Shares: ${data.shares}`}
                      />
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>❤️ {data.likes.toLocaleString()}</span>
                      <span>💬 {data.comments.toLocaleString()}</span>
                      <span>🔗 {data.shares.toLocaleString()}</span>
                      <span>👁 {data.reach.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
