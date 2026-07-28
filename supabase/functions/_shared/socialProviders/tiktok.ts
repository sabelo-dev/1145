// TikTok v2 OAuth (PKCE). Wired in Phase 2 with real API calls.

import type {
  OAuthAuthUrlInput,
  OAuthCodeExchangeInput,
  OAuthTokenBundle,
  ProviderProfile,
  SocialProvider,
} from "./index.ts";

const AUTH_HOST = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_HOST = "https://open.tiktokapis.com/v2/oauth/token/";
const USER_HOST = "https://open.tiktokapis.com/v2/user/info/";

export const tiktokProvider: SocialProvider = {
  id: "tiktok",
  displayName: "TikTok",
  requiredScopes: ["user.info.basic", "user.info.profile", "video.list"],
  optionalScopes: ["video.publish", "video.upload"],
  usesPkce: true,

  buildAuthUrl(input: OAuthAuthUrlInput): string {
    const clientKey = Deno.env.get("TIKTOK_CLIENT_KEY");
    if (!clientKey) throw new Error("TIKTOK_CLIENT_KEY not configured");
    if (!input.codeChallenge) throw new Error("TikTok requires PKCE code_challenge");
    const params = new URLSearchParams({
      client_key: clientKey,
      response_type: "code",
      scope: input.scopes.join(","),
      redirect_uri: input.redirectUri,
      state: input.state,
      code_challenge: input.codeChallenge,
      code_challenge_method: "S256",
    });
    return `${AUTH_HOST}?${params.toString()}`;
  },

  async exchangeCode(input: OAuthCodeExchangeInput): Promise<OAuthTokenBundle> {
    const clientKey = Deno.env.get("TIKTOK_CLIENT_KEY");
    const clientSecret = Deno.env.get("TIKTOK_CLIENT_SECRET");
    if (!clientKey || !clientSecret) throw new Error("TikTok OAuth secrets not configured");
    if (!input.codeVerifier) throw new Error("TikTok requires code_verifier");
    const body = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code: input.code,
      grant_type: "authorization_code",
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier,
    });
    const res = await fetch(TOKEN_HOST, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
      body,
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(`TikTok token exchange failed: ${JSON.stringify(data)}`);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type ?? "bearer",
      expiresIn: data.expires_in,
      scope: data.scope,
      raw: data,
    };
  },

  async refresh(refreshToken: string): Promise<OAuthTokenBundle> {
    const clientKey = Deno.env.get("TIKTOK_CLIENT_KEY");
    const clientSecret = Deno.env.get("TIKTOK_CLIENT_SECRET");
    if (!clientKey || !clientSecret) throw new Error("TikTok OAuth secrets not configured");
    const body = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
    const res = await fetch(TOKEN_HOST, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(`TikTok token refresh failed: ${JSON.stringify(data)}`);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type ?? "bearer",
      expiresIn: data.expires_in,
      scope: data.scope,
      raw: data,
    };
  },

  async readProfile(accessToken: string): Promise<ProviderProfile> {
    const res = await fetch(
      `${USER_HOST}?fields=open_id,union_id,avatar_url,display_name,username`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const data = await res.json();
    if (!res.ok || data.error?.code !== "ok") {
      throw new Error(`TikTok profile read failed: ${JSON.stringify(data)}`);
    }
    const u = data.data?.user ?? {};
    return {
      providerAccountId: String(u.open_id),
      username: u.username ?? u.display_name,
      displayName: u.display_name,
      avatarUrl: u.avatar_url,
      accountType: "creator",
      raw: data,
    };
  },

  async probePublishCapability(_accessToken, _profile) {
    // TikTok publish requires the `video.publish` scope. Real probe happens
    // in Phase 3; for now we assume capability if the scope was granted
    // (checked at the caller against granted_scopes).
    return { supported: true };
  },
};
