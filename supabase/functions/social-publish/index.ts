import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PublishRequest {
  post_id: string;
  platforms?: string[];
}

interface PlatformResult {
  platform: string;
  success: boolean;
  external_post_id?: string;
  external_post_url?: string;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate request
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
    const body: PublishRequest = await req.json();
    const { post_id, platforms } = body;

    if (!post_id) {
      return new Response(
        JSON.stringify({ error: 'Post ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the post
    const { data: post, error: postError } = await supabase
      .from('social_media_posts')
      .select('*')
      .eq('id', post_id)
      .eq('created_by', userId)
      .single();

    if (postError || !post) {
      return new Response(
        JSON.stringify({ error: 'Post not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const targetPlatforms = platforms || post.platforms || [];
    const results: PlatformResult[] = [];
    const externalPostIds: Record<string, string> = {};

    // Get user's OAuth tokens for the target platforms
    const { data: tokens, error: tokensError } = await supabase
      .from('social_oauth_tokens')
      .select('*')
      .eq('user_id', userId)
      .in('platform', targetPlatforms)
      .eq('is_active', true);

    if (tokensError) {
      console.error('Error fetching tokens:', tokensError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch connected accounts' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Publish to each platform
    for (const platform of targetPlatforms) {
      const platformTokens = tokens?.filter(t => t.platform === platform) || [];
      
      if (platformTokens.length === 0) {
        results.push({
          platform,
          success: false,
          error: 'No connected account for this platform',
        });
        continue;
      }

      // Use the first available token
      const tokenData = platformTokens[0];

      try {
        let result: PlatformResult;

        switch (platform) {
          case 'facebook': {
            result = await publishToFacebook(post, tokenData);
            break;
          }
          case 'instagram': {
            result = await publishToInstagram(post, tokenData);
            break;
          }
          case 'twitter': {
            result = await publishToTwitter(post, tokenData);
            break;
          }
          case 'linkedin': {
            result = await publishToLinkedIn(post, tokenData);
            break;
          }
          default: {
            result = {
              platform,
              success: false,
              error: `Platform ${platform} not supported`,
            };
          }
        }

        results.push(result);
        
        if (result.success && result.external_post_id) {
          externalPostIds[platform] = result.external_post_id;
        }

        // Update last_used_at for the token
        await supabase
          .from('social_oauth_tokens')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', tokenData.id);

      } catch (error: any) {
        console.error(`Error publishing to ${platform}:`, error);
        results.push({
          platform,
          success: false,
          error: error.message || 'Failed to publish',
        });
      }
    }

    // Determine overall status
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    const overallStatus = successCount === 0 ? 'failed' : 'published';

    // Update post status and external IDs
    const { error: updateError } = await supabase
      .from('social_media_posts')
      .update({
        status: overallStatus,
        published_at: new Date().toISOString(),
        external_post_ids: { ...post.external_post_ids, ...externalPostIds },
        updated_at: new Date().toISOString(),
      })
      .eq('id', post_id);

    if (updateError) {
      console.error('Error updating post:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: successCount > 0,
        results,
        summary: {
          total: targetPlatforms.length,
          success: successCount,
          failed: failureCount,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in social-publish:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function publishToFacebook(post: any, tokenData: any): Promise<PlatformResult> {
  const accessToken = tokenData.page_access_token || tokenData.access_token;
  const pageId = tokenData.page_id || tokenData.account_id;

  // Determine if we have media
  const hasMedia = post.media_urls && post.media_urls.length > 0;
  let endpoint = `https://graph.facebook.com/v18.0/${pageId}/feed`;
  let body: Record<string, any> = {
    message: post.content,
    access_token: accessToken,
  };

  // If there are media URLs, upload them first
  if (hasMedia) {
    const photoIds: string[] = [];
    
    for (const mediaUrl of post.media_urls) {
      // Upload photo
      const photoResponse = await fetch(`https://graph.facebook.com/v18.0/${pageId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: mediaUrl,
          published: false,
          access_token: accessToken,
        }),
      });
      const photoData = await photoResponse.json();
      
      if (photoData.id) {
        photoIds.push(photoData.id);
      }
    }

    if (photoIds.length > 0) {
      body.attached_media = photoIds.map(id => ({ media_fbid: id }));
    }
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (data.error) {
    return {
      platform: 'facebook',
      success: false,
      error: data.error.message,
    };
  }

  return {
    platform: 'facebook',
    success: true,
    external_post_id: data.id,
    external_post_url: `https://facebook.com/${data.id}`,
  };
}

async function publishToInstagram(post: any, tokenData: any): Promise<PlatformResult> {
  const accessToken = tokenData.page_access_token || tokenData.access_token;
  const igAccountId = tokenData.account_id;

  // Instagram requires at least one image or video
  if (!post.media_urls || post.media_urls.length === 0) {
    return {
      platform: 'instagram',
      success: false,
      error: 'Instagram requires at least one image or video',
    };
  }

  // For single media post
  if (post.media_urls.length === 1) {
    const mediaUrl = post.media_urls[0];
    const isVideo = mediaUrl.match(/\.(mp4|mov|avi)$/i);

    // Step 1: Create media container
    const containerResponse = await fetch(`https://graph.facebook.com/v18.0/${igAccountId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        [isVideo ? 'video_url' : 'image_url']: mediaUrl,
        caption: post.content,
        access_token: accessToken,
      }),
    });

    const containerData = await containerResponse.json();

    if (containerData.error) {
      return {
        platform: 'instagram',
        success: false,
        error: containerData.error.message,
      };
    }

    // Wait for media to be ready if it's a video
    if (isVideo) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Step 2: Publish the container
    const publishResponse = await fetch(`https://graph.facebook.com/v18.0/${igAccountId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerData.id,
        access_token: accessToken,
      }),
    });

    const publishData = await publishResponse.json();

    if (publishData.error) {
      return {
        platform: 'instagram',
        success: false,
        error: publishData.error.message,
      };
    }

    return {
      platform: 'instagram',
      success: true,
      external_post_id: publishData.id,
      external_post_url: `https://instagram.com/p/${publishData.id}`,
    };
  }

  // For carousel (multiple images)
  const mediaIds: string[] = [];

  for (const mediaUrl of post.media_urls.slice(0, 10)) { // Max 10 items
    const isVideo = mediaUrl.match(/\.(mp4|mov|avi)$/i);
    
    const itemResponse = await fetch(`https://graph.facebook.com/v18.0/${igAccountId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        [isVideo ? 'video_url' : 'image_url']: mediaUrl,
        is_carousel_item: true,
        access_token: accessToken,
      }),
    });

    const itemData = await itemResponse.json();
    if (itemData.id) {
      mediaIds.push(itemData.id);
    }
  }

  // Create carousel container
  const carouselResponse = await fetch(`https://graph.facebook.com/v18.0/${igAccountId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'CAROUSEL',
      children: mediaIds,
      caption: post.content,
      access_token: accessToken,
    }),
  });

  const carouselData = await carouselResponse.json();

  if (carouselData.error) {
    return {
      platform: 'instagram',
      success: false,
      error: carouselData.error.message,
    };
  }

  // Publish carousel
  const publishResponse = await fetch(`https://graph.facebook.com/v18.0/${igAccountId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: carouselData.id,
      access_token: accessToken,
    }),
  });

  const publishData = await publishResponse.json();

  if (publishData.error) {
    return {
      platform: 'instagram',
      success: false,
      error: publishData.error.message,
    };
  }

  return {
    platform: 'instagram',
    success: true,
    external_post_id: publishData.id,
    external_post_url: `https://instagram.com/p/${publishData.id}`,
  };
}

async function publishToTwitter(post: any, tokenData: any): Promise<PlatformResult> {
  const accessToken = tokenData.access_token;

  // Upload media if present
  let mediaIds: string[] = [];
  
  if (post.media_urls && post.media_urls.length > 0) {
    // Twitter media upload requires special handling
    // For now, we'll skip media upload - Twitter v2 API media upload is complex
    // and requires chunked uploads for most media types
    console.log('Twitter media upload not yet implemented for v2 API');
  }

  // Create tweet
  const tweetBody: Record<string, any> = {
    text: post.content.substring(0, 280), // Twitter limit
  };

  if (mediaIds.length > 0) {
    tweetBody.media = { media_ids: mediaIds };
  }

  const response = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(tweetBody),
  });

  const data = await response.json();

  if (data.errors || data.error) {
    return {
      platform: 'twitter',
      success: false,
      error: data.errors?.[0]?.message || data.error || data.detail || 'Failed to post tweet',
    };
  }

  return {
    platform: 'twitter',
    success: true,
    external_post_id: data.data?.id,
    external_post_url: `https://twitter.com/i/status/${data.data?.id}`,
  };
}

async function publishToLinkedIn(post: any, tokenData: any): Promise<PlatformResult> {
  const accessToken = tokenData.access_token;
  const personId = tokenData.account_id;

  // Get UGC URN format
  const authorUrn = `urn:li:person:${personId}`;

  // Build share content
  const shareBody: Record<string, any> = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: {
          text: post.content,
        },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  // If there are media URLs, we need to upload them first
  if (post.media_urls && post.media_urls.length > 0) {
    // For simplicity, just use the first image as a link preview
    // Full media upload requires register + upload flow
    shareBody.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'ARTICLE';
    shareBody.specificContent['com.linkedin.ugc.ShareContent'].media = [{
      status: 'READY',
      originalUrl: post.media_urls[0],
    }];
  }

  const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(shareBody),
  });

  if (!response.ok) {
    const errorData = await response.json();
    return {
      platform: 'linkedin',
      success: false,
      error: errorData.message || `HTTP ${response.status}`,
    };
  }

  const postId = response.headers.get('x-restli-id') || '';

  return {
    platform: 'linkedin',
    success: true,
    external_post_id: postId,
    external_post_url: `https://www.linkedin.com/feed/update/${postId}`,
  };
}
