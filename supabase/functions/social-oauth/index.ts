import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OAuthConfig {
  facebook: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scope: string[];
  };
  twitter: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scope: string[];
  };
  linkedin: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scope: string[];
  };
}

const getOAuthConfig = (baseUrl: string): OAuthConfig => ({
  facebook: {
    clientId: Deno.env.get('FACEBOOK_APP_ID') || '',
    clientSecret: Deno.env.get('FACEBOOK_APP_SECRET') || '',
    redirectUri: `${baseUrl}/social-oauth-callback`,
    scope: ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list', 'instagram_basic', 'instagram_content_publish', 'instagram_manage_insights'],
  },
  twitter: {
    clientId: Deno.env.get('TWITTER_CLIENT_ID') || '',
    clientSecret: Deno.env.get('TWITTER_CLIENT_SECRET') || '',
    redirectUri: `${baseUrl}/social-oauth-callback`,
    scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
  },
  linkedin: {
    clientId: Deno.env.get('LINKEDIN_CLIENT_ID') || '',
    clientSecret: Deno.env.get('LINKEDIN_CLIENT_SECRET') || '',
    redirectUri: `${baseUrl}/social-oauth-callback`,
    scope: ['openid', 'profile', 'email', 'w_member_social'],
  },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const platform = url.searchParams.get('platform');
    const appBaseUrl = url.searchParams.get('app_url') || 'https://id-preview--d0859489-9381-447f-a186-2612cdbf9227.lovable.app';
    
    // Get auth token from header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No valid auth token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const userId = userData.user.id;
    const functionsUrl = `${supabaseUrl}/functions/v1`;
    const config = getOAuthConfig(functionsUrl);

    switch (action) {
      case 'get_auth_url': {
        if (!platform || !['facebook', 'twitter', 'linkedin', 'instagram'].includes(platform)) {
          return new Response(
            JSON.stringify({ error: 'Invalid platform' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let authUrl = '';
        const state = btoa(JSON.stringify({ userId, platform, appUrl: appBaseUrl }));

        if (platform === 'facebook' || platform === 'instagram') {
          // Facebook handles both Facebook and Instagram
          const fbConfig = config.facebook;
          if (!fbConfig.clientId) {
            return new Response(
              JSON.stringify({ 
                error: 'Facebook App not configured', 
                setup_required: true,
                instructions: 'Add FACEBOOK_APP_ID and FACEBOOK_APP_SECRET to edge function secrets'
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
            `client_id=${fbConfig.clientId}` +
            `&redirect_uri=${encodeURIComponent(fbConfig.redirectUri)}` +
            `&scope=${encodeURIComponent(fbConfig.scope.join(','))}` +
            `&state=${encodeURIComponent(state)}` +
            `&response_type=code`;
        } else if (platform === 'twitter') {
          const twitterConfig = config.twitter;
          if (!twitterConfig.clientId) {
            return new Response(
              JSON.stringify({ 
                error: 'Twitter App not configured', 
                setup_required: true,
                instructions: 'Add TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET to edge function secrets'
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          // Twitter OAuth 2.0 with PKCE
          const codeVerifier = crypto.randomUUID() + crypto.randomUUID();
          const encoder = new TextEncoder();
          const data = encoder.encode(codeVerifier);
          const digest = await crypto.subtle.digest('SHA-256', data);
          const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
          
          // Store code verifier in state for later use
          const twitterState = btoa(JSON.stringify({ 
            userId, 
            platform, 
            appUrl: appBaseUrl,
            codeVerifier 
          }));
          
          authUrl = `https://twitter.com/i/oauth2/authorize?` +
            `response_type=code` +
            `&client_id=${twitterConfig.clientId}` +
            `&redirect_uri=${encodeURIComponent(twitterConfig.redirectUri)}` +
            `&scope=${encodeURIComponent(twitterConfig.scope.join(' '))}` +
            `&state=${encodeURIComponent(twitterState)}` +
            `&code_challenge=${codeChallenge}` +
            `&code_challenge_method=S256`;
        } else if (platform === 'linkedin') {
          const linkedinConfig = config.linkedin;
          if (!linkedinConfig.clientId) {
            return new Response(
              JSON.stringify({ 
                error: 'LinkedIn App not configured', 
                setup_required: true,
                instructions: 'Add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET to edge function secrets'
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
            `response_type=code` +
            `&client_id=${linkedinConfig.clientId}` +
            `&redirect_uri=${encodeURIComponent(linkedinConfig.redirectUri)}` +
            `&scope=${encodeURIComponent(linkedinConfig.scope.join(' '))}` +
            `&state=${encodeURIComponent(state)}`;
        }

        return new Response(
          JSON.stringify({ auth_url: authUrl }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'list_tokens': {
        const { data: tokens, error } = await supabase
          .from('social_oauth_tokens')
          .select('id, platform, account_id, account_handle, page_name, is_active, token_expires_at, created_at')
          .eq('user_id', userId)
          .eq('is_active', true);

        if (error) {
          console.error('Error fetching tokens:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch connected accounts' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ tokens }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'disconnect': {
        const tokenId = url.searchParams.get('token_id');
        if (!tokenId) {
          return new Response(
            JSON.stringify({ error: 'Token ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabase
          .from('social_oauth_tokens')
          .delete()
          .eq('id', tokenId)
          .eq('user_id', userId);

        if (error) {
          console.error('Error disconnecting account:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to disconnect account' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'refresh_token': {
        const tokenId = url.searchParams.get('token_id');
        if (!tokenId) {
          return new Response(
            JSON.stringify({ error: 'Token ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get the existing token
        const { data: tokenData, error: fetchError } = await supabase
          .from('social_oauth_tokens')
          .select('*')
          .eq('id', tokenId)
          .eq('user_id', userId)
          .single();

        if (fetchError || !tokenData) {
          return new Response(
            JSON.stringify({ error: 'Token not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Refresh logic depends on platform
        let newAccessToken = '';
        let newExpiresAt: Date | null = null;

        if (tokenData.platform === 'facebook' || tokenData.platform === 'instagram') {
          // Facebook long-lived tokens last 60 days, can be refreshed
          const fbConfig = config.facebook;
          const refreshResponse = await fetch(
            `https://graph.facebook.com/v18.0/oauth/access_token?` +
            `grant_type=fb_exchange_token` +
            `&client_id=${fbConfig.clientId}` +
            `&client_secret=${fbConfig.clientSecret}` +
            `&fb_exchange_token=${tokenData.access_token}`
          );
          const refreshData = await refreshResponse.json();
          
          if (refreshData.access_token) {
            newAccessToken = refreshData.access_token;
            newExpiresAt = new Date(Date.now() + (refreshData.expires_in || 5184000) * 1000);
          }
        } else if (tokenData.platform === 'twitter') {
          const twitterConfig = config.twitter;
          const refreshResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': `Basic ${btoa(`${twitterConfig.clientId}:${twitterConfig.clientSecret}`)}`,
            },
            body: new URLSearchParams({
              grant_type: 'refresh_token',
              refresh_token: tokenData.refresh_token || '',
            }),
          });
          const refreshData = await refreshResponse.json();
          
          if (refreshData.access_token) {
            newAccessToken = refreshData.access_token;
            newExpiresAt = new Date(Date.now() + (refreshData.expires_in || 7200) * 1000);
            
            // Update refresh token if provided
            if (refreshData.refresh_token) {
              await supabase
                .from('social_oauth_tokens')
                .update({ refresh_token: refreshData.refresh_token })
                .eq('id', tokenId);
            }
          }
        } else if (tokenData.platform === 'linkedin') {
          const linkedinConfig = config.linkedin;
          const refreshResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'refresh_token',
              refresh_token: tokenData.refresh_token || '',
              client_id: linkedinConfig.clientId,
              client_secret: linkedinConfig.clientSecret,
            }),
          });
          const refreshData = await refreshResponse.json();
          
          if (refreshData.access_token) {
            newAccessToken = refreshData.access_token;
            newExpiresAt = new Date(Date.now() + (refreshData.expires_in || 5184000) * 1000);
          }
        }

        if (newAccessToken) {
          const { error: updateError } = await supabase
            .from('social_oauth_tokens')
            .update({
              access_token: newAccessToken,
              token_expires_at: newExpiresAt?.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', tokenId);

          if (updateError) {
            return new Response(
              JSON.stringify({ error: 'Failed to update token' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify({ success: true, expires_at: newExpiresAt }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ error: 'Failed to refresh token' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: any) {
    console.error('Error in social-oauth:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
