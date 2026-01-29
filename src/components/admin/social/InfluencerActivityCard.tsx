import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp, FileText, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface InfluencerActivity {
  id: string;
  influencer_name: string;
  action: string;
  timestamp: string;
  details?: string;
}

interface InfluencerStats {
  totalInfluencers: number;
  activeInfluencers: number;
  totalPosts: number;
  postsThisMonth: number;
}

export const InfluencerActivityCard: React.FC = () => {
  const [activities, setActivities] = useState<InfluencerActivity[]>([]);
  const [stats, setStats] = useState<InfluencerStats>({
    totalInfluencers: 0,
    activeInfluencers: 0,
    totalPosts: 0,
    postsThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch influencer stats
        const { data: influencers } = await supabase
          .from('influencer_profiles')
          .select('id, is_active');

        const { data: posts } = await supabase
          .from('social_media_posts')
          .select('id, created_at, created_by');

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const postsThisMonth = posts?.filter(
          (p) => new Date(p.created_at) >= startOfMonth
        ).length || 0;

        setStats({
          totalInfluencers: influencers?.length || 0,
          activeInfluencers: influencers?.filter((i) => i.is_active).length || 0,
          totalPosts: posts?.length || 0,
          postsThisMonth,
        });

        // Fetch recent activities (posts with author info)
        const { data: recentPosts } = await supabase
          .from('social_media_posts')
          .select(`
            id,
            title,
            status,
            created_at,
            created_by,
            profiles:created_by (name, email)
          `)
          .order('created_at', { ascending: false })
          .limit(5);

        const formattedActivities: InfluencerActivity[] = (recentPosts || []).map((post: any) => ({
          id: post.id,
          influencer_name: post.profiles?.name || post.profiles?.email || 'Unknown',
          action: post.status === 'published' ? 'Published a post' : 'Created a draft',
          timestamp: post.created_at,
          details: post.title,
        }));

        setActivities(formattedActivities);
      } catch (error) {
        console.error('Error fetching influencer activity:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Influencers</span>
            </div>
            <p className="text-2xl font-bold mt-2">{stats.totalInfluencers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Active</span>
            </div>
            <p className="text-2xl font-bold mt-2">{stats.activeInfluencers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Total Posts</span>
            </div>
            <p className="text-2xl font-bold mt-2">{stats.totalPosts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">This Month</span>
            </div>
            <p className="text-2xl font-bold mt-2">{stats.postsThisMonth}</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>Latest actions from influencers</CardDescription>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No recent activity</p>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start justify-between border-b pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium">{activity.influencer_name}</p>
                    <p className="text-sm text-muted-foreground">{activity.action}</p>
                    {activity.details && (
                      <p className="text-xs text-muted-foreground mt-1">"{activity.details}"</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {format(new Date(activity.timestamp), 'MMM d, HH:mm')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
