import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { INSTAGRAM_GRAPH, instagramAppCredentials, META_GRAPH, metaAppCredentials, verifyState } from '../_shared/meta.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface LinkedAccount {
  platform: string;
  id: string;
  handle: string;
  url: string;
  followers?: number;
}

// social_accounts (used by UCoin mining tasks) only accepts these platforms.
const MINING_PLATFORMS = new Set(['instagram', 'facebook', 'twitter', 'tiktok', 'youtube']);

async function graphGet(path: string, params: Record<string, string>): Promise<any> {
  const res = await fetch(`${META_GRAPH}/${path}?${new URLSearchParams(params).toString()}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.error) {
    throw new Error(body?.error?.message || `Meta request failed (${res.status})`);
  }
  return body;
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
  let redirectUrl = 'https://1145.io/influencer/dashboard?tab=accounts';

  try {
    if (error) {
      console.error('OAuth error:', error, errorDescription);
      return Response.redirect(`${redirectUrl}&error=${encodeURIComponent(errorDescription || error)}`);
    }

    if (!code || !stateParam) {
      return Response.redirect(`${redirectUrl}&error=missing_code_or_state`);
    }

    // Verify the signed state — the user id in it decides whose account this is
    let stateData;
    try {
      stateData = await verifyState(stateParam);
      if (stateData.appUrl) {
        const path = stateData.returnPath || '/influencer/dashboard?tab=accounts';
        // Status params are appended with "&", so make sure a query exists.
        redirectUrl = `${stateData.appUrl}${path}${path.includes('?') ? '' : '?'}`;
      }
    } catch (e) {
      console.error('Failed to verify state:', e);
      return Response.redirect(`${redirectUrl}&error=${encodeURIComponent('Connection link expired or invalid. Please try again.')}`);
    }

    const { userId, platform, codeVerifier } = stateData;
    const functionsUrl = `${supabaseUrl}/functions/v1`;

    let tokenData: any = null;
    let accountInfo: any = null;
    const linked: LinkedAccount[] = [];

    if (platform === 'instagram' && stateData.via === 'instagram') {
      // Instagram API with Instagram Login: no Facebook Page involved.
      const { appId: igAppId, appSecret: igAppSecret } = instagramAppCredentials();
      if (!igAppId || !igAppSecret) {
        return Response.redirect(`${redirectUrl}&error=instagram_not_configured`);
      }

      // Instagram appends "#_" to the code; strip it defensively.
      const igCode = code.replace(/#_$/, '');
      const shortRes = await fetch('https://api.instagram.com/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: igAppId,
          client_secret: igAppSecret,
          grant_type: 'authorization_code',
          redirect_uri: `${functionsUrl}/social-oauth-callback`,
          code: igCode,
        }),
      });
      const shortToken = await shortRes.json().catch(() => ({}));
      if (!shortRes.ok || !shortToken.access_token) {
        const message = shortToken.error_message || shortToken.error?.message || 'Instagram sign-in failed';
        return Response.redirect(`${redirectUrl}&error=${encodeURIComponent(message)}`);
      }

      // 60-day token; fall back to the short-lived one if the exchange fails.
      const longRes = await fetch('https://graph.instagram.com/access_token?' + new URLSearchParams({
        grant_type: 'ig_exchange_token',
        client_secret: igAppSecret,
        access_token: shortToken.access_token,
      }).toString());
      const longToken = await longRes.json().catch(() => ({}));
      const accessToken = longToken.access_token || shortToken.access_token;
      const expiresIn = longToken.expires_in || 3600;

      const profileRes = await fetch(`${INSTAGRAM_GRAPH}/me?` + new URLSearchParams({
        fields: 'user_id,username,account_type,followers_count',
        access_token: accessToken,
      }).toString());
      const profile = await profileRes.json().catch(() => ({}));
      if (!profileRes.ok || profile.error) {
        const message = profile.error?.message || 'Could not read your Instagram profile';
        return Response.redirect(`${redirectUrl}&error=${encodeURIComponent(message)}`);
      }

      // Publishing / insights use the professional account id.
      const igUserId = String(profile.user_id || profile.id || shortToken.user_id);
      const handle = profile.username || igUserId;

      const { error: upsertError } = await supabase
        .from('social_oauth_tokens')
        .upsert({
          user_id: userId,
          platform: 'instagram',
          account_id: igUserId,
          account_handle: handle,
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
          // No Page: tells publish/sync to use graph.instagram.com.
          page_id: null,
          page_name: null,
          page_access_token: null,
          scope: Array.isArray(shortToken.permissions)
            ? shortToken.permissions
            : typeof shortToken.permissions === 'string' ? shortToken.permissions.split(',') : [],
          is_active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,platform,account_id' });
      if (upsertError) throw new Error(`Failed to save connection: ${upsertError.message}`);

      linked.push({
        platform: 'instagram',
        id: igUserId,
        handle,
        url: profile.username ? `https://instagram.com/${profile.username}` : '',
        followers: profile.followers_count,
      });
    } else if (platform === 'facebook' || platform === 'instagram') {
      const { appId: fbAppId, appSecret: fbAppSecret } = metaAppCredentials();

      if (!fbAppId || !fbAppSecret) {
        console.error('Facebook credentials not configured');
        return Response.redirect(`${redirectUrl}&error=facebook_not_configured`);
      }

      // Exchange code for a short-lived token, then for a long-lived one
      const shortLivedToken = await graphGet('oauth/access_token', {
        client_id: fbAppId,
        redirect_uri: `${functionsUrl}/social-oauth-callback`,
        client_secret: fbAppSecret,
        code,
      });

      const longLivedToken = await graphGet('oauth/access_token', {
        grant_type: 'fb_exchange_token',
        client_id: fbAppId,
        client_secret: fbAppSecret,
        fb_exchange_token: shortLivedToken.access_token,
      }).catch((e) => {
        console.error('Long-lived token exchange failed:', e);
        return {} as any;
      });

      const accessToken = longLivedToken.access_token || shortLivedToken.access_token;
      tokenData = {
        access_token: accessToken,
        expires_in: longLivedToken.expires_in || shortLivedToken.expires_in || 5184000,
      };
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

      const userInfo = await graphGet('me', { fields: 'id,name', access_token: accessToken });

      // Page tokens derived from a long-lived user token do not expire.
      const pagesData = await graphGet('me/accounts', {
        fields: 'id,name,access_token,link,followers_count,fan_count,instagram_business_account{id,username,followers_count}',
        limit: '100',
        access_token: accessToken,
      });
      const pages: any[] = pagesData.data || [];

      const upsertToken = async (row: Record<string, unknown>) => {
        const { error: upsertError } = await supabase
          .from('social_oauth_tokens')
          .upsert({
            user_id: userId,
            token_expires_at: expiresAt,
            is_active: true,
            updated_at: new Date().toISOString(),
            ...row,
          }, { onConflict: 'user_id,platform,account_id' });
        if (upsertError) throw new Error(`Failed to save connection: ${upsertError.message}`);
      };

      // Store each Page (and its linked Instagram professional account) as a connection
      for (const page of pages) {
        await upsertToken({
          platform: 'facebook',
          account_id: page.id,
          account_handle: page.name,
          access_token: accessToken,
          page_id: page.id,
          page_name: page.name,
          page_access_token: page.access_token,
        });
        linked.push({
          platform: 'facebook',
          id: page.id,
          handle: page.name,
          url: page.link || `https://facebook.com/${page.id}`,
          followers: page.followers_count ?? page.fan_count,
        });

        const ig = page.instagram_business_account;
        if (ig?.id) {
          await upsertToken({
            platform: 'instagram',
            account_id: ig.id,
            account_handle: ig.username || ig.id,
            access_token: page.access_token,
            page_id: page.id,
            page_name: page.name,
            page_access_token: page.access_token,
          });
          linked.push({
            platform: 'instagram',
            id: ig.id,
            handle: ig.username || ig.id,
            url: ig.username ? `https://instagram.com/${ig.username}` : '',
            followers: ig.followers_count,
          });
        }
      }

      if (pages.length === 0) {
        // Keep the user token so publishing can pick up a Page granted later.
        await upsertToken({
          platform: 'facebook',
          account_id: userInfo.id,
          account_handle: userInfo.name,
          access_token: accessToken,
        });
        return Response.redirect(`${redirectUrl}&error=${encodeURIComponent(
          'Facebook connected, but no Page was shared. Publishing needs a Facebook Page you manage: reconnect and select your Page.',
        )}`);
      }

      if (platform === 'instagram' && !linked.some((a) => a.platform === 'instagram')) {
        return Response.redirect(`${redirectUrl}&error=${encodeURIComponent(
          'No Instagram professional account is linked to the selected Facebook Page. Switch Instagram to a Business or Creator account, link it to your Page, then reconnect.',
        )}`);
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

    if (accountInfo && linked.length === 0) {
      linked.push({
        platform,
        id: String(accountInfo.id),
        handle: accountInfo.username || accountInfo.name || accountInfo.id,
        url: platform === 'twitter'
          ? `https://x.com/${accountInfo.username}`
          : platform === 'linkedin'
          ? `https://linkedin.com/in/${accountInfo.id}`
          : platform === 'tiktok'
          ? `https://tiktok.com/@${accountInfo.username || accountInfo.id}`
          : '',
      });
    }

    // Mirror verified connections into the influencer and mining account tables
    for (const account of linked) {
      const now = new Date().toISOString();
      const { error: approvedError } = await supabase
        .from('approved_social_accounts')
        .upsert({
          user_id: userId,
          platform: account.platform,
          account_handle: account.handle,
          account_url: account.url || null,
          is_verified: true,
          verified_at: now,
          is_active: true,
          updated_at: now,
        }, { onConflict: 'user_id,platform,account_handle' });
      if (approvedError) console.error('approved_social_accounts sync failed:', approvedError);

      if (MINING_PLATFORMS.has(account.platform)) {
        const { error: miningError } = await supabase
          .from('social_accounts')
          .upsert({
            user_id: userId,
            platform: account.platform,
            platform_user_id: account.id,
            username: account.handle,
            display_name: account.handle,
            profile_url: account.url || null,
            follower_count: account.followers ?? 0,
            is_verified: true,
            status: 'active',
            connected_at: now,
            last_synced_at: now,
          }, { onConflict: 'user_id,platform' });
        if (miningError) console.error('social_accounts sync failed:', miningError);
      }
    }

    // Reward each newly verified account once. The key has no user id, so the
    // same social account cannot be farmed from several 1145 accounts.
    let rewarded = 0;
    for (const account of linked) {
      const name = ({ facebook: 'Facebook', instagram: 'Instagram', twitter: 'X', linkedin: 'LinkedIn', tiktok: 'TikTok' } as Record<string, string>)[account.platform] || account.platform;
      const { data: amount, error: rewardError } = await supabase.rpc('award_activity', {
        p_user_id: userId,
        p_activity_code: 'social_connect',
        p_idempotency_key: `social_connect:${account.platform}:${account.id}`,
        p_reference_type: 'social_account',
        p_reference_id: `${account.platform}:${account.id}`,
        p_title: `Connected ${name} (@${account.handle})`,
      });
      if (rewardError) console.error('social_connect reward failed:', rewardError);
      else rewarded += Number(amount) || 0;
    }

    return Response.redirect(
      `${redirectUrl}&success=true&platform=${platform}${rewarded > 0 ? `&reward=${rewarded}` : ''}`,
    );
    
  } catch (err: any) {
    console.error('OAuth callback error:', err);
    return Response.redirect(`${redirectUrl}&error=${encodeURIComponent(err.message || 'Unknown error')}`);
  }
});
