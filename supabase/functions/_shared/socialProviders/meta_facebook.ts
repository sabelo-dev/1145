// Meta / Facebook provider skeleton. Wired in Phase 2 with real Graph API calls
// once META_APP_ID / META_APP_SECRET are configured.

import type {
  OAuthAuthUrlInput,
  OAuthCodeExchangeInput,
  OAuthTokenBundle,
  ProviderProfile,
  SocialProvider,
} from "./index.ts";

const AUTH_HOST = "https://www.facebook.com/v20.0/dialog/oauth";
const GRAPH = "https://graph.facebook.com/v20.0";

export const metaFacebookProvider: SocialProvider = {
  id: "facebook",
  displayName: "Facebook",
  requiredScopes: [
    "public_profile",
    "email",
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
  ],
  optionalScopes: ["read_insights", "pages_manage_metadata"],
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
    if (!res.ok) throw new Error(`Meta token exchange failed: ${JSON.stringify(body)}`);
    return {
      accessToken: body.access_token,
      tokenType: body.token_type ?? "bearer",
      expiresIn: body.expires_in,
      raw: body,
    };
  },

  async readProfile(accessToken: string): Promise<ProviderProfile> {
    const res = await fetch(
      `${GRAPH}/me?fields=id,name,email,picture&access_token=${encodeURIComponent(accessToken)}`,
    );
    const body = await res.json();
    if (!res.ok) throw new Error(`Meta profile read failed: ${JSON.stringify(body)}`);
    return {
      providerAccountId: String(body.id),
      username: body.name,
      displayName: body.name,
      avatarUrl: body.picture?.data?.url,
      accountType: "user",
      raw: body,
    };
  },

  async probePublishCapability(accessToken) {
    // Confirms the user has at least one page they can post to.
    const res = await fetch(
      `${GRAPH}/me/accounts?fields=id,name,tasks&access_token=${encodeURIComponent(accessToken)}`,
    );
    const body = await res.json();
    if (!res.ok) return { supported: false, reason: JSON.stringify(body) };
    const pages = Array.isArray(body.data) ? body.data : [];
    const canPost = pages.some((p: { tasks?: string[] }) =>
      Array.isArray(p.tasks) && p.tasks.includes("CREATE_CONTENT"),
    );
    return {
      supported: canPost,
      reason: canPost ? undefined : "No Facebook Page grants CREATE_CONTENT",
      details: { page_count: pages.length },
    };
  },
};
