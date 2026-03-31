import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface StateData {
  userId: string;
  platform: string;
  appUrl: string;
  codeVerifier?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  // Default redirect URL
  let redirectUrl = 'https://1145lifestyle.com/influencer/dashboard?tab=accounts';

  try {
    if (error) {
      console.error('OAuth error:', error, errorDescription);
      return Response.redirect(`${redirectUrl}&error=${encodeURIComponent(errorDescription || error)}`);
    }

    if (!code || !stateParam) {
      return Response.redirect(`${redirectUrl}&error=missing_code_or_state`);
    }

    // Decode state
    let stateData: StateData;
    try {
      stateData = JSON.parse(atob(decodeURIComponent(stateParam)));
      if (stateData.appUrl) {
        redirectUrl = `${stateData.appUrl}/influencer/dashboard?tab=accounts`;
      }
    } catch (e) {
      console.error('Failed to decode state:', e);
      return Response.redirect(`${redirectUrl}&error=invalid_state`);
    }

    const { userId, platform, codeVerifier } = stateData;
    const functionsUrl = `${supabaseUrl}/functions/v1`;

    let tokenData: any = null;
    let accountInfo: any = null;

    if (platform === 'facebook' || platform === 'instagram') {
      const fbAppId = Deno.env.get('FACEBOOK_APP_ID');
      const fbAppSecret = Deno.env.get('FACEBOOK_APP_SECRET');
      
      if (!fbAppId || !fbAppSecret) {
        console.error('Facebook credentials not configured');
        return Response.redirect(`${redirectUrl}&error=facebook_not_configured`);
      }

      // Exchange code for short-lived token
      const tokenResponse = await fetch(
        `https://graph.facebook.com/v18.0/oauth/access_token?` +
        `client_id=${fbAppId}` +
        `&redirect_uri=${encodeURIComponent(`${functionsUrl}/social-oauth-callback`)}` +
        `&client_secret=${fbAppSecret}` +
        `&code=${code}`
      );
      
      const shortLivedToken = await tokenResponse.json();
      console.log('Facebook token exchange status:', tokenResponse.status);
      
      if (shortLivedToken.error) {
        console.error('Facebook token error:', JSON.stringify(shortLivedToken.error));
        return Response.redirect(`${redirectUrl}&error=${encodeURIComponent(shortLivedToken.error.message || 'Facebook auth failed')}`);
      }

      // Exchange for long-lived token
      const longLivedResponse = await fetch(
        `https://graph.facebook.com/v18.0/oauth/access_token?` +
        `grant_type=fb_exchange_token` +
        `&client_id=${fbAppId}` +
        `&client_secret=${fbAppSecret}` +
        `&fb_exchange_token=${shortLivedToken.access_token}`
      );
      
      const longLivedToken = await longLivedResponse.json();
      const accessToken = longLivedToken.access_token || shortLivedToken.access_token;
      
      // Get user info
      const userResponse = await fetch(
        `https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${accessToken}`
      );
      const userInfo = await userResponse.json();
      
      // Get pages the user manages
      const pagesResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${accessToken}`
      );
      const pagesData = await pagesResponse.json();
      
      tokenData = {
        access_token: accessToken,
        expires_in: longLivedToken.expires_in || 5184000,
      };
      
      accountInfo = {
        id: userInfo.id,
        name: userInfo.name,
        pages: pagesData.data || [],
      };

      // Store each page as a separate connection
      for (const page of pagesData.data || []) {
        const instagramAccount = page.instagram_business_account;
        
        await supabase
          .from('social_oauth_tokens')
          .upsert({
            user_id: userId,
            platform: 'facebook',
            account_id: page.id,
            account_handle: page.name,
            access_token: tokenData.access_token,
            token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
            page_id: page.id,
            page_name: page.name,
            page_access_token: page.access_token,
            is_active: true,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,platform,account_id',
          });

        if (instagramAccount) {
          const igResponse = await fetch(
            `https://graph.facebook.com/v18.0/${instagramAccount.id}?fields=id,username&access_token=${page.access_token}`
          );
          const igInfo = await igResponse.json();
          
          await supabase
            .from('social_oauth_tokens')
            .upsert({
              user_id: userId,
              platform: 'instagram',
              account_id: instagramAccount.id,
              account_handle: igInfo.username || instagramAccount.id,
              access_token: page.access_token,
              token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
              page_id: page.id,
              page_name: page.name,
              page_access_token: page.access_token,
              is_active: true,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'user_id,platform,account_id',
            });
        }
      }

      // Store user-level token if no pages found
      if (!pagesData.data?.length) {
        await supabase
          .from('social_oauth_tokens')
          .upsert({
            user_id: userId,
            platform: 'facebook',
            account_id: userInfo.id,
            account_handle: userInfo.name,
            access_token: tokenData.access_token,
            token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
            is_active: true,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,platform,account_id',
          });
      }
      
    } else if (platform === 'twitter') {
      const twitterClientId = Deno.env.get('TWITTER_CLIENT_ID');
      const twitterClientSecret = Deno.env.get('TWITTER_CLIENT_SECRET');
      
      if (!twitterClientId || !twitterClientSecret) {
        console.error('Twitter credentials not configured');
        return Response.redirect(`${redirectUrl}&error=twitter_not_configured`);
      }

      const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${twitterClientId}:${twitterClientSecret}`)}`,
        },
        body: new URLSearchParams({
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: `${functionsUrl}/social-oauth-callback`,
          code_verifier: codeVerifier || '',
        }),
      });
      
      tokenData = await tokenResponse.json();
      console.log('Twitter token exchange status:', tokenResponse.status);
      
      if (tokenData.error) {
        console.error('Twitter token error:', JSON.stringify(tokenData));
        return Response.redirect(`${redirectUrl}&error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`);
      }

      // Get user info
      const userResponse = await fetch('https://api.twitter.com/2/users/me', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      });
      const twitterUserData = await userResponse.json();
      
      accountInfo = {
        id: twitterUserData.data?.id,
        username: twitterUserData.data?.username,
        name: twitterUserData.data?.name,
      };

      await supabase
        .from('social_oauth_tokens')
        .upsert({
          user_id: userId,
          platform: 'twitter',
          account_id: accountInfo.id,
          account_handle: accountInfo.username,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: new Date(Date.now() + (tokenData.expires_in || 7200) * 1000).toISOString(),
          scope: tokenData.scope?.split(' ') || [],
          is_active: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,platform,account_id',
        });
        
    } else if (platform === 'linkedin') {
      const linkedinClientId = Deno.env.get('LINKEDIN_CLIENT_ID');
      const linkedinClientSecret = Deno.env.get('LINKEDIN_CLIENT_SECRET');
      
      if (!linkedinClientId || !linkedinClientSecret) {
        console.error('LinkedIn credentials not configured');
        return Response.redirect(`${redirectUrl}&error=linkedin_not_configured`);
      }

      const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: `${functionsUrl}/social-oauth-callback`,
          client_id: linkedinClientId,
          client_secret: linkedinClientSecret,
        }),
      });
      
      tokenData = await tokenResponse.json();
      console.log('LinkedIn token exchange status:', tokenResponse.status);
      
      if (tokenData.error) {
        console.error('LinkedIn token error:', JSON.stringify(tokenData));
        return Response.redirect(`${redirectUrl}&error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`);
      }

      // Get user profile
      const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      });
      const profileData = await profileResponse.json();
      
      accountInfo = {
        id: profileData.sub,
        name: profileData.name,
        email: profileData.email,
      };

      await supabase
        .from('social_oauth_tokens')
        .upsert({
          user_id: userId,
          platform: 'linkedin',
          account_id: accountInfo.id,
          account_handle: accountInfo.name,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: new Date(Date.now() + (tokenData.expires_in || 5184000) * 1000).toISOString(),
          is_active: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,platform,account_id',
        });
    } else if (platform === 'tiktok') {
      const tiktokClientKey = Deno.env.get('TIKTOK_CLIENT_KEY');
      const tiktokClientSecret = Deno.env.get('TIKTOK_CLIENT_SECRET');
      
      if (!tiktokClientKey || !tiktokClientSecret) {
        console.error('TikTok credentials not configured');
        return Response.redirect(`${redirectUrl}&error=tiktok_not_configured`);
      }

      const tokenResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_key: tiktokClientKey,
          client_secret: tiktokClientSecret,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: `${functionsUrl}/social-oauth-callback`,
          code_verifier: codeVerifier || '',
        }),
      });
      
      tokenData = await tokenResponse.json();
      console.log('TikTok token exchange status:', tokenResponse.status);
      
      if (tokenData.error || !tokenData.access_token) {
        console.error('TikTok token error:', JSON.stringify(tokenData));
        const errMsg = tokenData.error_description || tokenData.error || 'TikTok auth failed';
        return Response.redirect(`${redirectUrl}&error=${encodeURIComponent(errMsg)}`);
      }

      // Get user info
      const userResponse = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      });
      const tiktokUserData = await userResponse.json();
      const tiktokUser = tiktokUserData?.data?.user || {};
      
      accountInfo = {
        id: tokenData.open_id || tiktokUser.open_id,
        username: tiktokUser.username || tiktokUser.display_name,
        name: tiktokUser.display_name,
      };

      await supabase
        .from('social_oauth_tokens')
        .upsert({
          user_id: userId,
          platform: 'tiktok',
          account_id: accountInfo.id,
          account_handle: accountInfo.username || accountInfo.id,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: new Date(Date.now() + (tokenData.expires_in || 86400) * 1000).toISOString(),
          scope: tokenData.scope ? (typeof tokenData.scope === 'string' ? tokenData.scope.split(',') : tokenData.scope) : [],
          is_active: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,platform,account_id',
        });
    }

    // Sync to approved_social_accounts for the influencer system
    if (accountInfo) {
      const handle = accountInfo.username || accountInfo.name || accountInfo.id;
      const accountUrl = platform === 'twitter' 
        ? `https://twitter.com/${accountInfo.username}`
        : platform === 'instagram'
        ? `https://instagram.com/${accountInfo.username || accountInfo.name}`
        : platform === 'linkedin'
        ? `https://linkedin.com/in/${accountInfo.id}`
        : `https://facebook.com/${accountInfo.id}`;

      await supabase
        .from('approved_social_accounts')
        .upsert({
          user_id: userId,
          platform,
          account_handle: handle,
          account_url: accountUrl,
          is_verified: true,
          verified_at: new Date().toISOString(),
          is_active: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,platform,account_handle',
          ignoreDuplicates: false,
        });
    }

    return Response.redirect(`${redirectUrl}&success=true&platform=${platform}`);
    
  } catch (err: any) {
    console.error('OAuth callback error:', err);
    return Response.redirect(`${redirectUrl}&error=${encodeURIComponent(err.message || 'Unknown error')}`);
  }
});
