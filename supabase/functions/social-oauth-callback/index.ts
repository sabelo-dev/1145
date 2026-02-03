import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StateData {
  userId: string;
  platform: string;
  appUrl: string;
  codeVerifier?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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
  let redirectUrl = 'https://id-preview--d0859489-9381-447f-a186-2612cdbf9227.lovable.app/influencer/dashboard?tab=accounts';

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

    // Exchange code for token based on platform
    let tokenData: any = null;
    let accountInfo: any = null;

    if (platform === 'facebook' || platform === 'instagram') {
      const fbAppId = Deno.env.get('FACEBOOK_APP_ID');
      const fbAppSecret = Deno.env.get('FACEBOOK_APP_SECRET');
      
      // Exchange code for short-lived token
      const tokenResponse = await fetch(
        `https://graph.facebook.com/v18.0/oauth/access_token?` +
        `client_id=${fbAppId}` +
        `&redirect_uri=${encodeURIComponent(`${functionsUrl}/social-oauth-callback`)}` +
        `&client_secret=${fbAppSecret}` +
        `&code=${code}`
      );
      
      const shortLivedToken = await tokenResponse.json();
      console.log('Facebook token response:', JSON.stringify(shortLivedToken));
      
      if (shortLivedToken.error) {
        return Response.redirect(`${redirectUrl}&error=${encodeURIComponent(shortLivedToken.error.message)}`);
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
      
      // Get user info
      const userResponse = await fetch(
        `https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${longLivedToken.access_token || shortLivedToken.access_token}`
      );
      const userInfo = await userResponse.json();
      
      // Get pages the user manages
      const pagesResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${longLivedToken.access_token || shortLivedToken.access_token}`
      );
      const pagesData = await pagesResponse.json();
      
      tokenData = {
        access_token: longLivedToken.access_token || shortLivedToken.access_token,
        expires_in: longLivedToken.expires_in || 5184000, // ~60 days
      };
      
      accountInfo = {
        id: userInfo.id,
        name: userInfo.name,
        pages: pagesData.data || [],
      };

      // Store each page as a separate connection
      for (const page of pagesData.data || []) {
        const instagramAccount = page.instagram_business_account;
        
        // Store Facebook page token
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

        // If Instagram business account is connected, store that too
        if (instagramAccount) {
          // Get Instagram account info
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

      // Also store user-level token for basic access
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
      
      const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${twitterClientId}:${twitterClientSecret}`)}`,
        },
        body: new URLSearchParams({
          code,
          grant_type: 'authorization_code',
          redirect_uri: `${functionsUrl}/social-oauth-callback`,
          code_verifier: codeVerifier || '',
        }),
      });
      
      tokenData = await tokenResponse.json();
      console.log('Twitter token response:', JSON.stringify(tokenData));
      
      if (tokenData.error) {
        return Response.redirect(`${redirectUrl}&error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`);
      }

      // Get user info
      const userResponse = await fetch('https://api.twitter.com/2/users/me', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      });
      const userData = await userResponse.json();
      
      accountInfo = {
        id: userData.data?.id,
        username: userData.data?.username,
        name: userData.data?.name,
      };

      // Store token
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
      
      const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: `${functionsUrl}/social-oauth-callback`,
          client_id: linkedinClientId!,
          client_secret: linkedinClientSecret!,
        }),
      });
      
      tokenData = await tokenResponse.json();
      console.log('LinkedIn token response:', JSON.stringify(tokenData));
      
      if (tokenData.error) {
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

      // Store token
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
    }

    // Also sync to approved_social_accounts for the influencer system
    if (accountInfo) {
      await supabase
        .from('approved_social_accounts')
        .upsert({
          user_id: userId,
          platform,
          account_handle: accountInfo.username || accountInfo.name || accountInfo.id,
          account_url: platform === 'twitter' 
            ? `https://twitter.com/${accountInfo.username}`
            : platform === 'instagram'
            ? `https://instagram.com/${accountInfo.username || accountInfo.name}`
            : platform === 'linkedin'
            ? `https://linkedin.com/in/${accountInfo.id}`
            : `https://facebook.com/${accountInfo.id}`,
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
    
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    return Response.redirect(`${redirectUrl}&error=${encodeURIComponent(error.message || 'Unknown error')}`);
  }
});
