// Instagram via Meta Graph (Instagram Login for Business). Wired in Phase 2.

import type {
  OAuthAuthUrlInput,
  OAuthCodeExchangeInput,
  OAuthTokenBundle,
  ProviderProfile,
  SocialProvider,
} from "./index.ts";

const AUTH_HOST = "https://www.facebook.com/v20.0/dialog/oauth";
const GRAPH = "https://graph.facebook.com/v20.0";

export const metaInstagramProvider: SocialProvider = {
  id: "instagram",
  displayName: "Instagram",
  requiredScopes: [
    "instagram_basic",
    "instagram_content_publish",
    "instagram_manage_comments",
    "instagram_manage_insights",
    "pages_show_list",
    "pages_read_engagement",
    "business_management",
  ],
  usesPkce: false,

  buildAuthUrl(input: OAuthAuthUrlInput): string {
    const clientId = Deno.env.get("META_APP_ID");
    if (!clientId) throw new Error("META_APP_ID not configured");
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: input.redirectUri,
      state: input.state,
      response_type: "code",
      scope: input.scopes.join(","),
    });
    return `${AUTH_HOST}?${params.toString()}`;
  },

  async exchangeCode(input: OAuthCodeExchangeInput): Promise<OAuthTokenBundle> {
    const clientId = Deno.env.get("META_APP_ID");
    const clientSecret = Deno.env.get("META_APP_SECRET");
    if (!clientId || !clientSecret) throw new Error("Meta OAuth secrets not configured");
    const url = new URL(`${GRAPH}/oauth/access_token`);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("client_secret", clientSecret);
    url.searchParams.set("redirect_uri", input.redirectUri);
    url.searchParams.set("code", input.code);
    const res = await fetch(url.toString());
    const body = await res.json();
    if (!res.ok) throw new Error(`Instagram token exchange failed: ${JSON.stringify(body)}`);
    return {
      accessToken: body.access_token,
      tokenType: body.token_type ?? "bearer",
      expiresIn: body.expires_in,
      raw: body,
    };
  },

  async readProfile(accessToken: string): Promise<ProviderProfile> {
    // Instagram business account is exposed via the linked FB page.
    const pagesRes = await fetch(
      `${GRAPH}/me/accounts?fields=id,name,instagram_business_account{id,username,name,profile_picture_url}&access_token=${encodeURIComponent(accessToken)}`,
    );
    const pagesBody = await pagesRes.json();
    if (!pagesRes.ok) throw new Error(`Instagram page lookup failed: ${JSON.stringify(pagesBody)}`);
    const page = (pagesBody.data ?? []).find((p: { instagram_business_account?: unknown }) =>
      p.instagram_business_account,
    );
    if (!page || !page.instagram_business_account) {
      throw new Error("No Instagram Business account linked to any managed Facebook Page");
    }
    const ig = page.instagram_business_account;
    return {
      providerAccountId: String(ig.id),
      username: ig.username,
      displayName: ig.name ?? ig.username,
      avatarUrl: ig.profile_picture_url,
      accountType: "business",
      raw: { page, instagram: ig },
    };
  },

  async probePublishCapability(accessToken, profile) {
    // Instagram content publishing is proven by successfully requesting the
    // container endpoint metadata; we do NOT create a container here.
    const res = await fetch(
      `${GRAPH}/${profile.providerAccountId}?fields=id,username&access_token=${encodeURIComponent(accessToken)}`,
    );
    const body = await res.json();
    if (!res.ok) return { supported: false, reason: JSON.stringify(body) };
    return { supported: true, details: body };
  },
};
