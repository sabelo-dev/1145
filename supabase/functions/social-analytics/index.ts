import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = userData.user.id;
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const postId = url.searchParams.get('post_id');

    switch (action) {
      case 'fetch_metrics': {
        if (!postId) {
          return new Response(
            JSON.stringify({ error: 'Post ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get the post and its external IDs
        const { data: post, error: postError } = await supabase
          .from('social_media_posts')
          .select('*')
          .eq('id', postId)
          .eq('created_by', userId)
          .single();

        if (postError || !post) {
          return new Response(
            JSON.stringify({ error: 'Post not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const externalPostIds = post.external_post_ids || {};
        const metrics: Record<string, any> = {};

        // Get user's tokens
        const { data: tokens } = await supabase
          .from('social_oauth_tokens')
          .select('*')
          .eq('user_id', userId)
          .eq('is_active', true);

        // Fetch metrics from each platform
        for (const [platform, externalId] of Object.entries(externalPostIds)) {
          const tokenData = tokens?.find(t => t.platform === platform);
          if (!tokenData || !externalId) continue;

          try {
            let platformMetrics: any = null;

            switch (platform) {
              case 'facebook': {
                platformMetrics = await fetchFacebookMetrics(externalId as string, tokenData);
                break;
              }
              case 'instagram': {
                platformMetrics = await fetchInstagramMetrics(externalId as string, tokenData);
                break;
              }
              case 'twitter': {
                platformMetrics = await fetchTwitterMetrics(externalId as string, tokenData);
                break;
              }
              case 'linkedin': {
                platformMetrics = await fetchLinkedInMetrics(externalId as string, tokenData);
                break;
              }
            }

            if (platformMetrics) {
              metrics[platform] = platformMetrics;

              // Store metrics in database
              await supabase
                .from('social_post_metrics')
                .insert({
                  post_id: postId,
                  platform,
                  external_post_id: externalId,
                  likes: platformMetrics.likes || 0,
                  comments: platformMetrics.comments || 0,
                  shares: platformMetrics.shares || 0,
                  reach: platformMetrics.reach || 0,
                  impressions: platformMetrics.impressions || 0,
                  clicks: platformMetrics.clicks || 0,
                  engagement_rate: platformMetrics.engagement_rate,
                  raw_data: platformMetrics.raw_data,
                });
            }
          } catch (error) {
            console.error(`Error fetching ${platform} metrics:`, error);
            metrics[platform] = { error: 'Failed to fetch metrics' };
          }
        }

        return new Response(
          JSON.stringify({ metrics }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_history': {
        if (!postId) {
          return new Response(
            JSON.stringify({ error: 'Post ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: history, error } = await supabase
          .from('social_post_metrics')
          .select('*')
          .eq('post_id', postId)
          .order('fetched_at', { ascending: false })
          .limit(100);

        if (error) {
          return new Response(
            JSON.stringify({ error: 'Failed to fetch history' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ history }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_summary': {
        // Get overall summary for user's posts
        const { data: posts, error: postsError } = await supabase
          .from('social_media_posts')
          .select('id')
          .eq('created_by', userId)
          .eq('status', 'published');

        if (postsError) {
          return new Response(
            JSON.stringify({ error: 'Failed to fetch posts' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const postIds = posts?.map(p => p.id) || [];

        if (postIds.length === 0) {
          return new Response(
            JSON.stringify({ 
              summary: {
                total_posts: 0,
                total_likes: 0,
                total_comments: 0,
                total_shares: 0,
                total_reach: 0,
                by_platform: {},
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get latest metrics for each post/platform combination
        const { data: latestMetrics, error: metricsError } = await supabase
          .from('social_post_metrics')
          .select('*')
          .in('post_id', postIds)
          .order('fetched_at', { ascending: false });

        if (metricsError) {
          return new Response(
            JSON.stringify({ error: 'Failed to fetch metrics' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Aggregate metrics (take latest per post/platform)
        const latestByPostPlatform = new Map<string, any>();
        for (const metric of latestMetrics || []) {
          const key = `${metric.post_id}-${metric.platform}`;
          if (!latestByPostPlatform.has(key)) {
            latestByPostPlatform.set(key, metric);
          }
        }

        const summary = {
          total_posts: postIds.length,
          total_likes: 0,
          total_comments: 0,
          total_shares: 0,
          total_reach: 0,
          total_impressions: 0,
          by_platform: {} as Record<string, any>,
        };

        for (const metric of latestByPostPlatform.values()) {
          summary.total_likes += metric.likes || 0;
          summary.total_comments += metric.comments || 0;
          summary.total_shares += metric.shares || 0;
          summary.total_reach += metric.reach || 0;
          summary.total_impressions += metric.impressions || 0;

          if (!summary.by_platform[metric.platform]) {
            summary.by_platform[metric.platform] = {
              posts: 0,
              likes: 0,
              comments: 0,
              shares: 0,
              reach: 0,
            };
          }
          summary.by_platform[metric.platform].posts++;
          summary.by_platform[metric.platform].likes += metric.likes || 0;
          summary.by_platform[metric.platform].comments += metric.comments || 0;
          summary.by_platform[metric.platform].shares += metric.shares || 0;
          summary.by_platform[metric.platform].reach += metric.reach || 0;
        }

        return new Response(
          JSON.stringify({ summary }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error: any) {
    console.error('Error in social-analytics:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function fetchFacebookMetrics(postId: string, tokenData: any) {
  const accessToken = tokenData.page_access_token || tokenData.access_token;
  
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${postId}?` +
    `fields=likes.summary(true),comments.summary(true),shares,insights.metric(post_impressions,post_reach,post_clicks)` +
    `&access_token=${accessToken}`
  );

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  const insights = data.insights?.data || [];
  const getInsightValue = (name: string) => {
    const insight = insights.find((i: any) => i.name === name);
    return insight?.values?.[0]?.value || 0;
  };

  return {
    likes: data.likes?.summary?.total_count || 0,
    comments: data.comments?.summary?.total_count || 0,
    shares: data.shares?.count || 0,
    impressions: getInsightValue('post_impressions'),
    reach: getInsightValue('post_reach'),
    clicks: getInsightValue('post_clicks'),
    raw_data: data,
  };
}

async function fetchInstagramMetrics(postId: string, tokenData: any) {
  const accessToken = tokenData.page_access_token || tokenData.access_token;
  
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${postId}?` +
    `fields=like_count,comments_count,impressions,reach,saved` +
    `&access_token=${accessToken}`
  );

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  return {
    likes: data.like_count || 0,
    comments: data.comments_count || 0,
    shares: data.saved || 0, // Instagram doesn't have shares, use saved
    impressions: data.impressions || 0,
    reach: data.reach || 0,
    raw_data: data,
  };
}

async function fetchTwitterMetrics(postId: string, tokenData: any) {
  const accessToken = tokenData.access_token;
  
  const response = await fetch(
    `https://api.twitter.com/2/tweets/${postId}?` +
    `tweet.fields=public_metrics`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  const data = await response.json();

  if (data.errors) {
    throw new Error(data.errors[0]?.message || 'Failed to fetch metrics');
  }

  const metrics = data.data?.public_metrics || {};

  return {
    likes: metrics.like_count || 0,
    comments: metrics.reply_count || 0,
    shares: metrics.retweet_count || 0,
    impressions: metrics.impression_count || 0,
    reach: metrics.impression_count || 0, // Twitter doesn't separate reach
    raw_data: data,
  };
}

async function fetchLinkedInMetrics(postId: string, tokenData: any) {
  const accessToken = tokenData.access_token;
  
  // LinkedIn requires specific endpoints for analytics
  const response = await fetch(
    `https://api.linkedin.com/v2/socialActions/${postId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`LinkedIn API error: ${response.status}`);
  }

  const data = await response.json();

  // Get engagement stats
  const likesResponse = await fetch(
    `https://api.linkedin.com/v2/socialActions/${postId}/likes?count=1`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    }
  );
  const likesData = await likesResponse.json();

  const commentsResponse = await fetch(
    `https://api.linkedin.com/v2/socialActions/${postId}/comments?count=1`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    }
  );
  const commentsData = await commentsResponse.json();

  return {
    likes: likesData.paging?.total || 0,
    comments: commentsData.paging?.total || 0,
    shares: 0, // LinkedIn shares require organization analytics API
    raw_data: { ...data, likes: likesData, comments: commentsData },
  };
}
