import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { META_GRAPH } from "../_shared/meta.ts";
import { decryptToken } from "../_shared/socialCrypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NormalizedPost {
  platform: string;
  platform_post_id: string;
  content_type: string;
  media_url: string | null;
  media_urls: string[];
  caption: string;
  permalink: string;
  posted_at: string;
  metrics: Record<string, number>;
}

interface NormalizedComment {
  platform: string;
  platform_comment_id: string;
  post_platform_id: string;
  username: string;
  user_avatar_url: string | null;
  text: string;
  posted_at: string;
  metrics: Record<string, number>;
}

// Platform-specific fetchers
interface TokenRow {
  platform: string;
  account_id: string | null;
  page_id: string | null;
  access_token: string | null;
  page_access_token: string | null;
}

async function graphGet(path: string, params: Record<string, string>): Promise<any> {
  const res = await fetch(`${META_GRAPH}/${path}?${new URLSearchParams(params).toString()}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.error) {
    throw new Error(body?.error?.message || `Meta request failed (${res.status})`);
  }
  return body;
}

async function tokenValue(value: string | null | undefined): Promise<string> {
  if (!value) throw new Error('Connection has no access token. Reconnect the account.');
  if (!value.startsWith('enc:v1:')) return value;
  const [, , iv, ciphertext] = value.split(':');
  return await decryptToken({ iv, ciphertext });
}

// Instagram professional account via Facebook Login: /{ig-user-id}/media with the Page token.
async function fetchInstagramPosts(token: TokenRow): Promise<{ posts: NormalizedPost[]; comments: NormalizedComment[] }> {
  if (!token.account_id) throw new Error('Instagram account id is missing. Reconnect Instagram.');
  const accessToken = await tokenValue(token.page_access_token || token.access_token);
  const posts: NormalizedPost[] = [];
  const comments: NormalizedComment[] = [];

  const mediaData = await graphGet(`${token.account_id}/media`, {
    fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
    limit: '50',
    access_token: accessToken,
  });

  for (const item of mediaData.data || []) {
    posts.push({
      platform: 'instagram',
      platform_post_id: item.id,
      content_type: item.media_type?.toLowerCase() || 'image',
      media_url: item.media_url || item.thumbnail_url || null,
      media_urls: item.media_url ? [item.media_url] : [],
      caption: item.caption || '',
      permalink: item.permalink || '',
      posted_at: item.timestamp,
      metrics: {
        likes: item.like_count || 0,
        comments: item.comments_count || 0,
      },
    });

    if (!item.comments_count) continue;
    try {
      const commentsData = await graphGet(`${item.id}/comments`, {
        fields: 'id,text,username,timestamp,like_count',
        limit: '50',
        access_token: accessToken,
      });
      for (const c of commentsData.data || []) {
        comments.push({
          platform: 'instagram',
          platform_comment_id: c.id,
          post_platform_id: item.id,
          username: c.username || 'unknown',
          user_avatar_url: null,
          text: c.text || '',
          posted_at: c.timestamp,
          metrics: { likes: c.like_count || 0 },
        });
      }
    } catch (e) {
      // Usually a missing instagram_manage_comments permission; keep the posts.
      console.error(`Failed to fetch comments for post ${item.id}:`, e);
    }
  }

  return { posts, comments };
}

// One Facebook Page per connection row, read with that Page's token.
async function fetchFacebookPosts(token: TokenRow): Promise<{ posts: NormalizedPost[]; comments: NormalizedComment[] }> {
  if (!token.page_id || !token.page_access_token) {
    throw new Error('No Facebook Page is connected. Reconnect Facebook and select your Page.');
  }
  const accessToken = await tokenValue(token.page_access_token);
  const posts: NormalizedPost[] = [];
  const comments: NormalizedComment[] = [];

  const feedData = await graphGet(`${token.page_id}/posts`, {
    fields: 'id,message,full_picture,permalink_url,created_time,shares,reactions.summary(true).limit(0),comments.summary(true).limit(25){id,message,from,created_time,like_count}',
    limit: '25',
    access_token: accessToken,
  });

  for (const item of feedData.data || []) {
    posts.push({
      platform: 'facebook',
      platform_post_id: item.id,
      content_type: item.full_picture ? 'image' : 'text',
      media_url: item.full_picture || null,
      media_urls: item.full_picture ? [item.full_picture] : [],
      caption: item.message || '',
      permalink: item.permalink_url || '',
      posted_at: item.created_time,
      metrics: {
        likes: item.reactions?.summary?.total_count || 0,
        comments: item.comments?.summary?.total_count || 0,
        shares: item.shares?.count || 0,
      },
    });

    for (const c of item.comments?.data || []) {
      comments.push({
        platform: 'facebook',
        platform_comment_id: c.id,
        post_platform_id: item.id,
        username: c.from?.name || 'Facebook user',
        user_avatar_url: null,
        text: c.message || '',
        posted_at: c.created_time,
        metrics: { likes: c.like_count || 0 },
      });
    }
  }

  return { posts, comments };
}

async function fetchTwitterPosts(accessToken: string): Promise<{ posts: NormalizedPost[]; comments: NormalizedComment[] }> {
  const posts: NormalizedPost[] = [];

  try {
    const tweetsRes = await fetch(
      `https://api.x.com/2/users/me/tweets?max_results=50&tweet.fields=created_at,public_metrics,entities&media.fields=url,preview_image_url&expansions=attachments.media_keys`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const tweetsData = await tweetsRes.json();

    for (const tweet of (tweetsData.data || [])) {
      posts.push({
        platform: 'twitter',
        platform_post_id: tweet.id,
        content_type: 'text',
        media_url: null,
        media_urls: [],
        caption: tweet.text || '',
        permalink: `https://x.com/i/status/${tweet.id}`,
        posted_at: tweet.created_at,
        metrics: {
          likes: tweet.public_metrics?.like_count || 0,
          comments: tweet.public_metrics?.reply_count || 0,
          shares: tweet.public_metrics?.retweet_count || 0,
          impressions: tweet.public_metrics?.impression_count || 0,
        },
      });
    }
  } catch (e) {
    console.error('Twitter fetch error:', e);
  }

  return { posts, comments: [] };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get influencer profile
    const { data: profile } = await supabase
      .from('influencer_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Not an influencer' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const targetPlatform = body.platform || 'all';

    // Get active OAuth connections (one row per Page / account)
    const { data: tokens } = await supabase
      .from('social_oauth_tokens')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);

    // Several connections can share a platform (e.g. two Pages); track the
    // per-platform totals so the status row reflects all of them.
    const platformTotals: Record<string, { posts: number; comments: number }> = {};

    const results: Record<string, { posts: number; comments: number; errors: string[] }> = {};
    let pagelessFacebook = false;

    for (const token of (tokens || [])) {
      if (targetPlatform !== 'all' && token.platform !== targetPlatform) continue;
      if (!['instagram', 'facebook', 'twitter'].includes(token.platform)) continue;
      // A user-level Facebook row without a Page cannot read a feed.
      if (token.platform === 'facebook' && !token.page_id) {
        pagelessFacebook = true;
        continue;
      }

      // Update sync status to syncing
      await supabase
        .from('influencer_sync_status')
        .upsert({
          influencer_id: profile.id,
          platform: token.platform,
          sync_status: 'syncing',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'influencer_id,platform' });

      let fetched: { posts: NormalizedPost[]; comments: NormalizedComment[] } = { posts: [], comments: [] };

      try {
        switch (token.platform) {
          case 'instagram':
            fetched = await fetchInstagramPosts(token);
            break;
          case 'facebook':
            fetched = await fetchFacebookPosts(token);
            break;
          case 'twitter':
            fetched = await fetchTwitterPosts(await tokenValue(token.access_token));
            break;
        }

        // Upsert posts
        for (const post of fetched.posts) {
          await supabase
            .from('influencer_social_posts')
            .upsert({
              influencer_id: profile.id,
              platform: post.platform,
              platform_post_id: post.platform_post_id,
              content_type: post.content_type,
              media_url: post.media_url,
              media_urls: post.media_urls,
              caption: post.caption,
              permalink: post.permalink,
              posted_at: post.posted_at,
              metrics: post.metrics,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'platform,platform_post_id' });
        }

        // Upsert comments
        for (const comment of fetched.comments) {
          // Find the internal post ID
          const { data: postRow } = await supabase
            .from('influencer_social_posts')
            .select('id')
            .eq('platform', comment.platform)
            .eq('platform_post_id', comment.post_platform_id)
            .single();

          if (postRow) {
            await supabase
              .from('influencer_comments')
              .upsert({
                post_id: postRow.id,
                platform: comment.platform,
                platform_comment_id: comment.platform_comment_id,
                username: comment.username,
                user_avatar_url: comment.user_avatar_url,
                text: comment.text,
                posted_at: comment.posted_at,
                metrics: comment.metrics,
              }, { onConflict: 'platform,platform_comment_id' });
          }
        }

        // Upsert engagement metrics
        const today = new Date().toISOString().split('T')[0];
        const aggregated = fetched.posts.reduce(
          (acc, p) => ({
            likes: acc.likes + (p.metrics.likes || 0),
            comments: acc.comments + (p.metrics.comments || 0),
            shares: acc.shares + (p.metrics.shares || 0),
            reach: acc.reach + (p.metrics.reach || 0),
            impressions: acc.impressions + (p.metrics.impressions || 0),
          }),
          { likes: 0, comments: 0, shares: 0, reach: 0, impressions: 0 }
        );

        const totals = platformTotals[token.platform] ?? { posts: 0, comments: 0 };
        totals.posts += fetched.posts.length;
        totals.comments += fetched.comments.length;
        platformTotals[token.platform] = totals;

        // One aggregate row per influencer / platform / day (see the
        // influencer_engagement_metrics_daily_unique index).
        const metricRow = {
          ...aggregated,
          engagement_rate: aggregated.reach > 0
            ? ((aggregated.likes + aggregated.comments + aggregated.shares) / aggregated.reach) * 100
            : 0,
        };
        const { data: existingMetric } = await supabase
          .from('influencer_engagement_metrics')
          .select('id, likes, comments, shares, reach, impressions')
          .eq('influencer_id', profile.id)
          .eq('platform', token.platform)
          .eq('metric_date', today)
          .is('post_id', null)
          .maybeSingle();

        if (existingMetric && Object.keys(results).includes(token.platform)) {
          // Second connection on the same platform today: add to the first.
          await supabase
            .from('influencer_engagement_metrics')
            .update({
              likes: existingMetric.likes + metricRow.likes,
              comments: existingMetric.comments + metricRow.comments,
              shares: existingMetric.shares + metricRow.shares,
              reach: existingMetric.reach + metricRow.reach,
              impressions: existingMetric.impressions + metricRow.impressions,
            })
            .eq('id', existingMetric.id);
        } else if (existingMetric) {
          await supabase
            .from('influencer_engagement_metrics')
            .update(metricRow)
            .eq('id', existingMetric.id);
        } else {
          await supabase.from('influencer_engagement_metrics').insert({
            influencer_id: profile.id,
            platform: token.platform,
            metric_date: today,
            ...metricRow,
          });
        }

        // Update sync status
        await supabase
          .from('influencer_sync_status')
          .upsert({
            influencer_id: profile.id,
            platform: token.platform,
            sync_status: 'completed',
            last_sync_at: new Date().toISOString(),
            posts_synced: totals.posts,
            comments_synced: totals.comments,
            error_message: null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'influencer_id,platform' });

        results[token.platform] = {
          posts: totals.posts,
          comments: totals.comments,
          errors: results[token.platform]?.errors ?? [],
        };
      } catch (e: any) {
        console.error(`Sync error for ${token.platform}:`, e);

        await supabase
          .from('influencer_sync_status')
          .upsert({
            influencer_id: profile.id,
            platform: token.platform,
            sync_status: 'error',
            error_message: e.message,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'influencer_id,platform' });

        const prev = results[token.platform] ?? { posts: 0, comments: 0, errors: [] };
        results[token.platform] = { ...prev, errors: [...prev.errors, e.message] };
      }
    }

    // Facebook is connected, but only as a personal profile: say so instead
    // of reporting "nothing to sync".
    if (pagelessFacebook && !results.facebook && (targetPlatform === 'all' || targetPlatform === 'facebook')) {
      results.facebook = {
        posts: 0,
        comments: 0,
        errors: ['No Facebook Page is connected. Reconnect Facebook and select the Page you post from (personal profiles cannot be synced).'],
      };
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('Sync function error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
