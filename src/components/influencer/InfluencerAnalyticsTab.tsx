import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, FileText, Send, Calendar, TrendingUp } from 'lucide-react';
import type { SocialMediaPost } from '@/types/influencer';

interface InfluencerAnalyticsTabProps {
  posts: SocialMediaPost[];
}

export const InfluencerAnalyticsTab: React.FC<InfluencerAnalyticsTabProps> = ({ posts }) => {
  const publishedPosts = posts.filter(p => p.status === 'published');
  const scheduledPosts = posts.filter(p => p.status === 'scheduled');
  const draftPosts = posts.filter(p => p.status === 'draft');

  const stats = [
    {
      label: 'Total Posts',
      value: posts.length,
      icon: FileText,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Published',
      value: publishedPosts.length,
      icon: Send,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
    },
    {
      label: 'Scheduled',
      value: scheduledPosts.length,
      icon: Calendar,
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
    },
    {
      label: 'Drafts',
      value: draftPosts.length,
      icon: FileText,
      color: 'text-gray-500',
      bg: 'bg-gray-500/10',
    },
  ];

  // Calculate posts by platform
  const platformStats: Record<string, number> = {};
  posts.forEach(post => {
    post.platforms.forEach(platform => {
      platformStats[platform] = (platformStats[platform] || 0) + 1;
    });
  });

  // Calculate posts by content type
  const contentTypeStats: Record<string, number> = {};
  posts.forEach(post => {
    contentTypeStats[post.content_type] = (contentTypeStats[post.content_type] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Analytics</h2>
        <p className="text-muted-foreground">Overview of your social media activity</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Posts by Platform */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Posts by Platform
            </CardTitle>
            <CardDescription>Distribution of your posts across platforms</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(platformStats).length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No data yet</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(platformStats).map(([platform, count]) => (
                  <div key={platform} className="flex items-center justify-between">
                    <span className="capitalize">{platform}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${(count / posts.length) * 100}%` }}
                        />
                      </div>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Posts by Content Type */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Posts by Content Type
            </CardTitle>
            <CardDescription>Types of content you've created</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(contentTypeStats).length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No data yet</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(contentTypeStats).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="capitalize">{type.replace('_', ' ')}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${(count / posts.length) * 100}%` }}
                        />
                      </div>
                      <Badge variant="outline">{count}</Badge>
                    </div>
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
