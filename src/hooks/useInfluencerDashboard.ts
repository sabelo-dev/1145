import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface NormalizedPost {
  id: string;
  influencer_id: string;
  platform: string;
  platform_post_id: string;
  content_type: string;
  media_url: string | null;
  media_urls: string[];
  caption: string | null;
  permalink: string | null;
  posted_at: string | null;
  metrics: Record<string, any>;
  linked_product_id: string | null;
  is_synced: boolean;
  created_at: string;
}

export interface NormalizedComment {
  id: string;
  post_id: string;
  platform: string;
  platform_comment_id: string;
  parent_comment_id: string | null;
  username: string;
  user_avatar_url: string | null;
  text: string;
  sentiment: string;
  is_replied: boolean;
  is_handled: boolean;
  is_spam: boolean;
  is_high_value: boolean;
  reply_text: string | null;
  replied_at: string | null;
  posted_at: string;
  metrics: Record<string, any>;
  created_at: string;
}

export interface EngagementMetric {
  id: string;
  influencer_id: string;
  post_id: string | null;
  platform: string;
  metric_date: string;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  impressions: number;
  clicks: number;
  video_views: number;
  engagement_rate: number;
}

export interface Conversion {
  id: string;
  influencer_id: string;
  post_id: string | null;
  product_id: string | null;
  platform: string;
  event_type: string;
  revenue: number;
  commission: number;
  created_at: string;
}

export interface SyncStatus {
  id: string;
  influencer_id: string;
  platform: string;
  last_sync_at: string | null;
  sync_status: string;
  posts_synced: number;
  comments_synced: number;
  error_message: string | null;
}

export interface AISuggestion {
  id: string;
  comment_id: string | null;
  influencer_id: string;
  suggestion_type: string;
  suggested_text: string;
  confidence: number;
  is_used: boolean;
}

export const useInfluencerDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [influencerProfileId, setInfluencerProfileId] = useState<string | null>(null);
  const [socialPosts, setSocialPosts] = useState<NormalizedPost[]>([]);
  const [comments, setComments] = useState<NormalizedComment[]>([]);
  const [metrics, setMetrics] = useState<EngagementMetric[]>([]);
  const [conversions, setConversions] = useState<Conversion[]>([]);
  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([]);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);

  const fetchProfileId = useCallback(async () => {
    if (!user) return null;
    const { data } = await supabase
      .from('influencer_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    return data?.id || null;
  }, [user]);

  const fetchSocialPosts = useCallback(async (profileId: string) => {
    const { data } = await supabase
      .from('influencer_social_posts')
      .select('*')
      .eq('influencer_id', profileId)
      .order('posted_at', { ascending: false })
      .limit(100);
    setSocialPosts((data as NormalizedPost[]) || []);
  }, []);

  const fetchComments = useCallback(async (profileId: string) => {
    const { data: posts } = await supabase
      .from('influencer_social_posts')
      .select('id')
      .eq('influencer_id', profileId);
    
    if (!posts || posts.length === 0) {
      setComments([]);
      return;
    }

    const postIds = posts.map(p => p.id);
    const { data } = await supabase
      .from('influencer_comments')
      .select('*')
      .in('post_id', postIds)
      .order('posted_at', { ascending: false })
      .limit(200);
    setComments((data as NormalizedComment[]) || []);
  }, []);

  const fetchMetrics = useCallback(async (profileId: string) => {
    const { data } = await supabase
      .from('influencer_engagement_metrics')
      .select('*')
      .eq('influencer_id', profileId)
      .order('metric_date', { ascending: false })
      .limit(90);
    setMetrics((data as EngagementMetric[]) || []);
  }, []);

  const fetchConversions = useCallback(async (profileId: string) => {
    const { data } = await supabase
      .from('influencer_conversions')
      .select('*')
      .eq('influencer_id', profileId)
      .order('created_at', { ascending: false })
      .limit(100);
    setConversions((data as Conversion[]) || []);
  }, []);

  const fetchSyncStatuses = useCallback(async (profileId: string) => {
    const { data } = await supabase
      .from('influencer_sync_status')
      .select('*')
      .eq('influencer_id', profileId);
    setSyncStatuses((data as SyncStatus[]) || []);
  }, []);

  // Only the first load shows the full-page loader; refreshes update in place.
  const loadedOnce = useRef(false);

  const loadAll = useCallback(async () => {
    if (!loadedOnce.current) setLoading(true);
    const profileId = await fetchProfileId();
    setInfluencerProfileId(profileId);
    
    if (profileId) {
      await Promise.all([
        fetchSocialPosts(profileId),
        fetchComments(profileId),
        fetchMetrics(profileId),
        fetchConversions(profileId),
        fetchSyncStatuses(profileId),
      ]);
    }
    loadedOnce.current = true;
    setLoading(false);
  }, [fetchProfileId, fetchSocialPosts, fetchComments, fetchMetrics, fetchConversions, fetchSyncStatuses]);

  useEffect(() => {
    if (user) loadAll();
  }, [user, loadAll]);

  // Pull posts, comments and metrics from the connected platforms.
  // `silent` skips the toasts, for background syncs such as after publishing.
  const syncContent = async (platform?: string, { silent = false }: { silent?: boolean } = {}) => {
    setSyncing(platform || 'all');
    try {
      const { data, error } = await supabase.functions.invoke('sync-influencer-content', {
        body: { platform: platform || 'all' },
      });
      if (error) {
        const body = await (error as any).context?.json?.().catch(() => null);
        throw new Error(body?.error || error.message);
      }

      const results = (data?.results ?? {}) as Record<string, { posts: number; comments: number; errors: string[] }>;
      const entries = Object.entries(results);
      const errors = entries.flatMap(([p, r]) => r.errors.map((e) => `${p}: ${e}`));

      if (silent) {
        if (errors.length > 0) console.warn('Background sync errors:', errors);
      } else if (entries.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Nothing to sync',
          description: 'Connect Facebook, Instagram or X under Accounts first.',
        });
      } else if (errors.length > 0) {
        toast({ variant: 'destructive', title: 'Sync finished with errors', description: errors.join('\n') });
      } else {
        const posts = entries.reduce((sum, [, r]) => sum + r.posts, 0);
        const comments = entries.reduce((sum, [, r]) => sum + r.comments, 0);
        toast({ title: 'Sync complete', description: `${posts} posts and ${comments} comments synced.` });
      }
    } catch (e: any) {
      if (silent) console.warn('Background sync failed:', e);
      else toast({ variant: 'destructive', title: 'Sync failed', description: e.message || 'Could not sync content' });
    } finally {
      setSyncing(null);
      await loadAll();
    }
  };

  const markCommentHandled = async (commentId: string, replyText?: string) => {
    const updates: Record<string, any> = {
      is_handled: true,
    };
    if (replyText) {
      updates.is_replied = true;
      updates.reply_text = replyText;
      updates.replied_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('influencer_comments')
      .update(updates as any)
      .eq('id', commentId);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update comment' });
      return false;
    }

    setComments(prev => prev.map(c => c.id === commentId ? { ...c, ...updates } : c));
    return true;
  };

  const markCommentSpam = async (commentId: string) => {
    const { error } = await supabase
      .from('influencer_comments')
      .update({ is_spam: true, is_handled: true })
      .eq('id', commentId);

    if (!error) {
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, is_spam: true, is_handled: true } : c));
    }
  };

  const linkProductToPost = async (postId: string, productId: string | null) => {
    const { error } = await supabase
      .from('influencer_social_posts')
      .update({ linked_product_id: productId })
      .eq('id', postId);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to link product' });
      return false;
    }

    setSocialPosts(prev => prev.map(p => p.id === postId ? { ...p, linked_product_id: productId } : p));
    toast({ title: 'Product Linked', description: 'Product has been linked to this post.' });
    return true;
  };

  // Aggregated stats
  const totalEngagement = metrics.reduce((sum, m) => sum + m.likes + m.comments + m.shares, 0);
  const totalReach = metrics.reduce((sum, m) => sum + m.reach, 0);
  const totalClicks = metrics.reduce((sum, m) => sum + m.clicks, 0);
  const totalRevenue = conversions.reduce((sum, c) => sum + c.revenue, 0);
  const totalCommission = conversions.reduce((sum, c) => sum + c.commission, 0);
  const totalConversions = conversions.filter(c => c.event_type === 'purchase').length;
  const unhandledComments = comments.filter(c => !c.is_handled && !c.is_spam).length;

  return {
    loading,
    influencerProfileId,
    socialPosts,
    comments,
    metrics,
    conversions,
    syncStatuses,
    suggestions,
    markCommentHandled,
    markCommentSpam,
    linkProductToPost,
    refresh: loadAll,
    syncContent,
    syncing,
    stats: {
      totalEngagement,
      totalReach,
      totalClicks,
      totalRevenue,
      totalCommission,
      totalConversions,
      unhandledComments,
      postCount: socialPosts.length,
    },
  };
};
