import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptToken } from "../_shared/socialCrypto.ts";
import { INSTAGRAM_GRAPH, META_GRAPH, META_GRAPH_VERSION } from "../_shared/meta.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

const LINKEDIN_VERSION =
  Deno.env.get("LINKEDIN_VERSION") || "202601";

const SUPPORTED_PLATFORMS = new Set([
  "facebook",
  "instagram",
  "twitter",
  "linkedin",
]);

function normalizePlatformName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function isDuplicatePublish(
  existingExternalIds: Record<string, string>,
  platform: string,
): boolean {
  return Boolean(existingExternalIds[platform]);
}

const MAX_INSTAGRAM_ITEMS = 10;
const INSTAGRAM_POLL_INTERVAL_MS = 2000;
const INSTAGRAM_MAX_POLLS = 30;

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

interface OAuthToken {
  id: string;
  platform: string;
  user_id: string;
  access_token?: string | null;
  page_access_token?: string | null;
  account_id?: string | null;
  page_id?: string | null;
  is_active?: boolean;
  updated_at?: string | null;
  last_used_at?: string | null;
}

interface SocialPost {
  id: string;
  created_by: string;
  content?: string | null;
  media_urls?: string[] | null;
  platforms?: string[] | null;
  status?: string | null;
  published_at?: string | null;
  external_post_ids?: Record<string, string> | null;
  external_post_url?: string | null;
  updated_at?: string | null;
  product_id?: string | null;
  /** Product photo, used by Facebook/Instagram when the post has no media of its own. */
  fallback_media?: string[];
  /** Product page link carrying the author's referral code. */
  share_link?: string | null;
  /** The author's referral code, for platforms where links are not clickable. */
  referral_code?: string | null;
}

const SITE_URL = (Deno.env.get("APP_URL") || Deno.env.get("SITE_URL") || "https://1145.io").replace(/\/+$/, "");

function postMedia(post: SocialPost): string[] {
  return Array.isArray(post.media_urls) ? post.media_urls.filter(Boolean) : [];
}

/** The post's own media, or the promoted product's photo when it has none. */
function mediaOrProductPhoto(post: SocialPost): string[] {
  const own = postMedia(post);
  return own.length > 0 ? own : post.fallback_media ?? [];
}

/** Post text with the share link on its own line; the text is trimmed, never the link. */
function captionWithLink(post: SocialPost, maxLength?: number): string {
  const text = post.content?.trim() || "";
  const link = post.share_link;
  if (!link || text.includes(link.split("?")[0])) {
    return maxLength ? text.slice(0, maxLength) : text;
  }
  const suffix = `${text ? "\n\n" : ""}Shop here: ${link}`;
  return (maxLength ? text.slice(0, Math.max(maxLength - suffix.length, 0)) : text) + suffix;
}

/*
 * Instagram never makes caption links clickable, so product posts point to the
 * author's bio link (see BioLinkCard in the dashboard) instead of a pasted URL.
 */
function instagramCaption(post: SocialPost, maxLength: number): string {
  const text = post.content?.trim() || "";
  if (!post.share_link || /link in (my |the )?bio/i.test(text)) {
    return text.slice(0, maxLength);
  }
  const code = post.referral_code ? ` · referral code ${post.referral_code}` : "";
  const suffix = `${text ? "\n\n" : ""}Shop via the link in my bio${code}`;
  return text.slice(0, Math.max(maxLength - suffix.length, 0)) + suffix;
}

/*
 * Product promotions: the product's photo stands in for missing media and the
 * caption gets the product link with the author's referral code.
 */
async function withProductDetails(
  supabase: any,
  post: SocialPost,
): Promise<SocialPost> {
  if (!post.product_id) return post;

  const [productRes, imageRes, codeRes] = await Promise.all([
    supabase.from("products").select("slug").eq("id", post.product_id).maybeSingle(),
    supabase.from("product_images").select("image_url").eq("product_id", post.product_id)
      .order("position", { ascending: true }).limit(1),
    supabase.rpc("get_or_create_referral_code", { p_user_id: post.created_by }),
  ]);

  if (productRes.error || imageRes.error) {
    console.error("Product lookup failed:", productRes.error || imageRes.error);
  }
  if (codeRes.error) {
    console.error("Referral code lookup failed:", codeRes.error);
  }

  const slug = productRes.data?.slug;
  const image = imageRes.data?.[0]?.image_url;
  const code = typeof codeRes.data === "string" ? codeRes.data : "";

  return {
    ...post,
    fallback_media: typeof image === "string" && /^https:\/\//i.test(image) ? [image] : [],
    share_link: slug
      ? `${SITE_URL}/product/${encodeURIComponent(slug)}${code ? `?ref=${encodeURIComponent(code)}` : ""}`
      : null,
    referral_code: code || null,
  };
}

/* -------------------------------------------------------------------------- */
/* Response helpers                                                           */
/* -------------------------------------------------------------------------- */

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

/* -------------------------------------------------------------------------- */
/* Token helpers                                                              */
/* -------------------------------------------------------------------------- */

async function decryptIfNecessary(
  token: string | null | undefined,
): Promise<string> {
  if (!token) {
    throw new Error("OAuth access token is missing");
  }

  if (!token.startsWith("enc:v1:")) {
    return token;
  }

  const parts = token.split(":");

  if (parts.length !== 4) {
    throw new Error("Invalid encrypted OAuth token format");
  }

  const [, version, iv, ciphertext] = parts;

  if (version !== "v1" || !iv || !ciphertext) {
    throw new Error("Invalid encrypted OAuth token");
  }

  return await decryptToken({
    iv,
    ciphertext,
  });
}

/* -------------------------------------------------------------------------- */
/* HTTP helpers                                                               */
/* -------------------------------------------------------------------------- */

async function readJson(response: Response): Promise<any> {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      raw: text,
    };
  }
}

function platformApiError(
  platform: string,
  response: Response,
  data: any,
): Error {
  const message =
    data?.error?.message ||
    data?.message ||
    data?.detail ||
    data?.errors?.[0]?.message ||
    `HTTP ${response.status}`;

  return new Error(`${platform}: ${message}`);
}

/* -------------------------------------------------------------------------- */
/* Supabase helpers                                                           */
/* -------------------------------------------------------------------------- */

async function getActiveToken(
  supabase: any,
  userId: string,
  platform: string,
): Promise<OAuthToken | null> {
  const { data, error } = await supabase
    .from("social_oauth_tokens")
    .select(`
      id,
      platform,
      user_id,
      access_token,
      page_access_token,
      account_id,
      page_id,
      is_active,
      updated_at,
      last_used_at
    `)
    .eq("user_id", userId)
    .eq("platform", platform)
    .eq("is_active", true)
    // Prefer a connection that already has a Page attached.
    .order("page_id", {
      ascending: false,
      nullsFirst: false,
    })
    .order("updated_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      `Failed loading ${platform} OAuth connection:`,
      error,
    );

    throw new Error(
      `Failed to load ${platform} connection`,
    );
  }

  return data as OAuthToken | null;
}

async function updateTokenLastUsed(
  supabase: any,
  tokenId: string,
): Promise<void> {
  const { error } = await supabase
    .from("social_oauth_tokens")
    .update({
      last_used_at: new Date().toISOString(),
    })
    .eq("id", tokenId);

  if (error) {
    // This should not turn a successful publication into a failed one.
    console.error(
      "Failed updating OAuth token last_used_at:",
      error,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Facebook                                                                   */
/* -------------------------------------------------------------------------- */

/*
 * Older connections were saved before a Page was chosen (or before the Page
 * permissions were granted). Rather than failing the post, look the Page up
 * again with the stored user token and repair the saved connection.
 */
async function ensureFacebookPage(
  supabase: any,
  tokenData: OAuthToken,
): Promise<OAuthToken> {
  if (tokenData.page_id && tokenData.page_access_token) {
    return tokenData;
  }

  const userToken = await decryptIfNecessary(
    tokenData.access_token,
  );

  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts?fields=id,name,access_token&access_token=${
      encodeURIComponent(userToken)
    }`,
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        "Could not read the Facebook Pages for this account",
    );
  }

  const page = (data?.data || [])[0];

  if (!page?.id || !page?.access_token) {
    throw new Error(
      "No Facebook Page found for this account. Create or select a Page you manage, then reconnect Facebook and allow the Page permissions.",
    );
  }

  await supabase
    .from("social_oauth_tokens")
    .update({
      account_id: page.id,
      account_handle: page.name,
      page_id: page.id,
      page_name: page.name,
      page_access_token: page.access_token,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tokenData.id);

  return {
    ...tokenData,
    page_id: page.id,
    page_access_token: page.access_token,
  };
}

async function publishToFacebook(
  post: SocialPost,
  tokenData: OAuthToken,
): Promise<PlatformResult> {
  if (!tokenData.page_id) {
    throw new Error(
      "Facebook Page is not connected",
    );
  }

  if (!tokenData.page_access_token) {
    throw new Error(
      "Facebook Page access token is missing",
    );
  }

  const pageAccessToken = await decryptIfNecessary(
    tokenData.page_access_token,
  );

  const pageId = tokenData.page_id;
  const message = captionWithLink(post);
  const mediaUrls = mediaOrProductPhoto(post);

  if (!message && mediaUrls.length === 0) {
    throw new Error(
      "Facebook post must contain text or media",
    );
  }

  /*
   * One image: publish it as a photo post, caption included. This is the
   * plain path and does not depend on attaching unpublished photos to a
   * feed post.
   */
  if (mediaUrls.length === 1 && !isVideoUrl(mediaUrls[0])) {
    const photoParams = new URLSearchParams({
      url: mediaUrls[0],
      access_token: pageAccessToken,
    });
    if (message) {
      photoParams.set("caption", message);
    }

    const photoResponse = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/photos`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body: photoParams,
      },
    );

    const photoData = await readJson(photoResponse);

    if (!photoResponse.ok || photoData?.error || !photoData?.id) {
      console.error(
        "Facebook photo post failed:",
        photoData,
      );

      throw platformApiError(
        "Facebook",
        photoResponse,
        photoData,
      );
    }

    const photoPostId = photoData.post_id || photoData.id;

    return {
      platform: "facebook",
      success: true,
      external_post_id: photoPostId,
      external_post_url:
        (await fetchPermalink(photoPostId, "permalink_url", pageAccessToken)) ||
        `https://www.facebook.com/${photoPostId}`,
    };
  }

  const attachedMedia: string[] = [];

  /*
   * Upload media as unpublished Page photos first.
   *
   * If any media fails, stop the publication rather than silently
   * publishing an incomplete post.
   */
  for (const mediaUrl of mediaUrls) {
    const photoResponse = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/photos`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          url: mediaUrl,
          published: "false",
          access_token: pageAccessToken,
        }),
      },
    );

    const photoData = await readJson(photoResponse);

    if (!photoResponse.ok || photoData?.error || !photoData?.id) {
      console.error(
        "Facebook media upload failed:",
        photoData,
      );

      throw platformApiError(
        "Facebook media upload",
        photoResponse,
        photoData,
      );
    }

    attachedMedia.push(photoData.id);
  }

  const params = new URLSearchParams({
    access_token: pageAccessToken,
  });

  if (message) {
    params.set("message", message);
  }

  // Text-only product post: let Facebook render the product page as a link card.
  if (attachedMedia.length === 0 && post.share_link) {
    params.set("link", post.share_link);
  }

  attachedMedia.forEach((mediaId, index) => {
    params.set(
      `attached_media[${index}]`,
      JSON.stringify({
        media_fbid: mediaId,
      }),
    );
  });

  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/feed`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: params,
    },
  );

  const data = await readJson(response);

  if (!response.ok || data?.error) {
    console.error(
      "Facebook Graph API error:",
      data,
    );

    throw platformApiError(
      "Facebook",
      response,
      data,
    );
  }

  if (!data?.id) {
    throw new Error(
      "Facebook returned no post ID",
    );
  }

  return {
    platform: "facebook",
    success: true,
    external_post_id: data.id,
    external_post_url:
      (await fetchPermalink(data.id, "permalink_url", pageAccessToken)) ||
      `https://www.facebook.com/${data.id}`,
  };
}

/*
 * Published IDs are not URL slugs (an Instagram media id is not the /p/
 * shortcode), so ask Graph for the real link. Never fail a publish over it.
 */
async function fetchPermalink(
  objectId: string,
  field: "permalink" | "permalink_url",
  accessToken: string,
  graphBase: string = META_GRAPH,
): Promise<string | null> {
  try {
    const response = await fetch(
      `${graphBase}/${objectId}?` +
        new URLSearchParams({
          fields: field,
          access_token: accessToken,
        }).toString(),
    );
    const data = await readJson(response);
    return response.ok && typeof data?.[field] === "string"
      ? data[field]
      : null;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Instagram                                                                  */
/* -------------------------------------------------------------------------- */

function isVideoUrl(url: string): boolean {
  const cleanUrl = url.split("?")[0].toLowerCase();

  return (
    cleanUrl.endsWith(".mp4") ||
    cleanUrl.endsWith(".mov") ||
    cleanUrl.endsWith(".m4v")
  );
}

async function waitForInstagramContainer(
  containerId: string,
  accessToken: string,
  graphBase: string,
): Promise<void> {
  for (let attempt = 0; attempt < INSTAGRAM_MAX_POLLS; attempt++) {
    const response = await fetch(
      `${graphBase}/${containerId}?` +
        new URLSearchParams({
          fields: "status_code,status",
          access_token: accessToken,
        }).toString(),
    );

    const data = await readJson(response);

    if (!response.ok || data?.error) {
      throw platformApiError(
        "Instagram container status",
        response,
        data,
      );
    }

    const statusCode =
      String(data?.status_code || "").toUpperCase();

    if (statusCode === "FINISHED") {
      return;
    }

    if (
      statusCode === "ERROR" ||
      statusCode === "EXPIRED"
    ) {
      throw new Error(
        `Instagram media container failed: ${
          data?.status || statusCode
        }`,
      );
    }

    await new Promise((resolve) =>
      setTimeout(
        resolve,
        INSTAGRAM_POLL_INTERVAL_MS,
      )
    );
  }

  throw new Error(
    "Instagram media container timed out",
  );
}

async function createInstagramContainer(
  igAccountId: string,
  accessToken: string,
  mediaUrl: string,
  caption: string | undefined,
  carouselItem: boolean,
  graphBase: string,
): Promise<string> {
  const video = isVideoUrl(mediaUrl);

  const body: Record<string, unknown> = {
    access_token: accessToken,
  };

  if (video) {
    body.video_url = mediaUrl;
    // Feed "VIDEO" is retired for single posts; videos publish as Reels.
    // Carousel children still use VIDEO.
    body.media_type = carouselItem ? "VIDEO" : "REELS";
  } else {
    body.image_url = mediaUrl;
  }

  if (caption && !carouselItem) {
    body.caption = caption;
  }

  if (carouselItem) {
    body.is_carousel_item = true;
  }

  const response = await fetch(
    `${graphBase}/${igAccountId}/media`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  const data = await readJson(response);

  if (!response.ok || data?.error || !data?.id) {
    throw platformApiError(
      "Instagram container creation",
      response,
      data,
    );
  }

  const containerId = data.id;

  /*
   * Poll for readiness rather than assuming five seconds is enough.
   */
  await waitForInstagramContainer(
    containerId,
    accessToken,
    graphBase,
  );

  return containerId;
}

async function publishInstagramContainer(
  igAccountId: string,
  accessToken: string,
  creationId: string,
  graphBase: string,
): Promise<string> {
  const response = await fetch(
    `${graphBase}/${igAccountId}/media_publish`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        creation_id: creationId,
        access_token: accessToken,
      }),
    },
  );

  const data = await readJson(response);

  if (!response.ok || data?.error || !data?.id) {
    throw platformApiError(
      "Instagram publishing",
      response,
      data,
    );
  }

  return data.id;
}

async function publishToInstagram(
  post: SocialPost,
  tokenData: OAuthToken,
): Promise<PlatformResult> {
  /*
   * Two kinds of Instagram connection:
   *  - Instagram Login (no Page): user token on graph.instagram.com
   *  - Facebook Login (linked Page): Page token on graph.facebook.com
   */
  const viaInstagramLogin = !tokenData.page_id;
  const graphBase = viaInstagramLogin ? INSTAGRAM_GRAPH : META_GRAPH;

  const accessToken = await decryptIfNecessary(
    viaInstagramLogin
      ? tokenData.access_token
      : tokenData.page_access_token || tokenData.access_token,
  );

  const igAccountId = tokenData.account_id;

  if (!igAccountId) {
    throw new Error(
      "Instagram Business/Creator account is not connected",
    );
  }

  const mediaUrls = mediaOrProductPhoto(post);
  const caption = instagramCaption(post, 2200);

  if (mediaUrls.length === 0) {
    return {
      platform: "instagram",
      success: false,
      error: post.product_id
        ? "Instagram needs an image or video, and the selected product has no photo to use"
        : "Instagram publishing requires at least one image or video",
    };
  }

  if (mediaUrls.length > MAX_INSTAGRAM_ITEMS) {
    throw new Error(
      `Instagram supports a maximum of ${MAX_INSTAGRAM_ITEMS} carousel items`,
    );
  }

  /*
   * Single image/video
   */
  if (mediaUrls.length === 1) {
    const containerId =
      await createInstagramContainer(
        igAccountId,
        accessToken,
        mediaUrls[0],
        caption || undefined,
        false,
        graphBase,
      );

    const publishedId =
      await publishInstagramContainer(
        igAccountId,
        accessToken,
        containerId,
        graphBase,
      );

    return {
      platform: "instagram",
      success: true,
      external_post_id: publishedId,
      external_post_url:
        (await fetchPermalink(publishedId, "permalink", accessToken, graphBase)) ||
        `https://www.instagram.com/`,
    };
  }

  /*
   * Carousel
   */
  const children: string[] = [];

  for (const mediaUrl of mediaUrls) {
    const childId =
      await createInstagramContainer(
        igAccountId,
        accessToken,
        mediaUrl,
        undefined,
        true,
        graphBase,
      );

    children.push(childId);
  }

  if (children.length !== mediaUrls.length) {
    throw new Error(
      "Instagram carousel media creation was incomplete",
    );
  }

  const carouselResponse = await fetch(
    `${graphBase}/${igAccountId}/media`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        media_type: "CAROUSEL",
        children,
        caption,
        access_token: accessToken,
      }),
    },
  );

  const carouselData =
    await readJson(carouselResponse);

  if (
    !carouselResponse.ok ||
    carouselData?.error ||
    !carouselData?.id
  ) {
    throw platformApiError(
      "Instagram carousel creation",
      carouselResponse,
      carouselData,
    );
  }

  await waitForInstagramContainer(
    carouselData.id,
    accessToken,
    graphBase,
  );

  const publishedId =
    await publishInstagramContainer(
      igAccountId,
      accessToken,
      carouselData.id,
      graphBase,
    );

  return {
    platform: "instagram",
    success: true,
    external_post_id: publishedId,
    external_post_url:
      (await fetchPermalink(publishedId, "permalink", accessToken, graphBase)) ||
      `https://www.instagram.com/`,
  };
}

/* -------------------------------------------------------------------------- */
/* X / Twitter                                                               */
/* -------------------------------------------------------------------------- */

async function publishToTwitter(
  post: SocialPost,
  tokenData: OAuthToken,
): Promise<PlatformResult> {
  const accessToken = await decryptIfNecessary(
    tokenData.access_token,
  );

  const mediaUrls = Array.isArray(post.media_urls)
    ? post.media_urls.filter(Boolean)
    : [];

  /*
   * Do NOT silently discard media.
   *
   * X media upload requires a separate media-upload workflow.
   * Until that workflow is implemented, explicitly reject
   * media posts instead of publishing an incomplete post.
   */
  if (mediaUrls.length > 0) {
    return {
      platform: "twitter",
      success: false,
      error:
        "X/Twitter media publishing is not implemented yet. Text-only publishing is supported.",
    };
  }

  const text = captionWithLink(post, 280);

  if (!text) {
    throw new Error(
      "X/Twitter post requires text",
    );
  }

  const response = await fetch(
    "https://api.twitter.com/2/tweets",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text.slice(0, 280),
      }),
    },
  );

  const data = await readJson(response);

  if (
    !response.ok ||
    data?.errors ||
    data?.error ||
    !data?.data?.id
  ) {
    throw platformApiError(
      "X/Twitter",
      response,
      data,
    );
  }

  const postId = data.data.id;

  return {
    platform: "twitter",
    success: true,
    external_post_id: postId,
    external_post_url:
      `https://x.com/i/status/${postId}`,
  };
}

/* -------------------------------------------------------------------------- */
/* LinkedIn                                                                  */
/* -------------------------------------------------------------------------- */

async function publishToLinkedIn(
  post: SocialPost,
  tokenData: OAuthToken,
): Promise<PlatformResult> {
  const accessToken = await decryptIfNecessary(
    tokenData.access_token,
  );

  const personId = tokenData.account_id;

  if (!personId) {
    throw new Error(
      "LinkedIn account ID is missing",
    );
  }

  const mediaUrls = Array.isArray(post.media_urls)
    ? post.media_urls.filter(Boolean)
    : [];

  /*
   * Do not pretend a public URL is a LinkedIn media asset.
   *
   * LinkedIn's current content flow requires an uploaded
   * image/video asset URN for native media posts.
   *
   * This implementation therefore safely supports text-only
   * publishing until the Images/Videos upload workflow is added.
   */
  if (mediaUrls.length > 0) {
    return {
      platform: "linkedin",
      success: false,
      error:
        "LinkedIn native media publishing requires the Images/Videos upload workflow and is not enabled in this function yet.",
    };
  }

  const text = captionWithLink(post, 3000);

  if (!text) {
    throw new Error(
      "LinkedIn post requires text",
    );
  }

  const authorUrn =
    `urn:li:person:${personId}`;

  const body = {
    author: authorUrn,
    commentary: text.slice(0, 3000),
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  const response = await fetch(
    "https://api.linkedin.com/rest/posts",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
        "Linkedin-Version": LINKEDIN_VERSION,
      },
      body: JSON.stringify(body),
    },
  );

  const data = await readJson(response);

  if (!response.ok) {
    throw platformApiError(
      "LinkedIn",
      response,
      data,
    );
  }

  /*
   * LinkedIn returns the post ID in the x-restli-id header.
   */
  const postId =
    response.headers.get("x-restli-id");

  if (!postId) {
    throw new Error(
      "LinkedIn returned no post ID",
    );
  }

  return {
    platform: "linkedin",
    success: true,
    external_post_id: postId,
    external_post_url:
      `https://www.linkedin.com/feed/update/${encodeURIComponent(postId)}`,
  };
}

/* -------------------------------------------------------------------------- */
/* Main publication dispatcher                                                */
/* -------------------------------------------------------------------------- */

async function publishPlatform(
  platform: string,
  post: SocialPost,
  tokenData: OAuthToken,
  supabase?: any,
): Promise<PlatformResult> {
  switch (platform) {
    case "facebook":
      return await publishToFacebook(
        post,
        supabase
          ? await ensureFacebookPage(supabase, tokenData)
          : tokenData,
      );

    case "instagram":
      // Instagram connections already carry the IG account id plus the Page
      // token. Do not run the Facebook repair here: it rewrites account_id
      // to the Page id, which breaks every later Instagram publish.
      if (!tokenData.page_access_token && !tokenData.access_token) {
        throw new Error("Instagram connection is incomplete. Reconnect Instagram.");
      }
      return await publishToInstagram(post, tokenData);

    case "twitter":
      return await publishToTwitter(
        post,
        tokenData,
      );

    case "linkedin":
      return await publishToLinkedIn(
        post,
        tokenData,
      );

    default:
      return {
        platform,
        success: false,
        error:
          `Platform "${platform}" is not supported`,
      };
  }
}

/* -------------------------------------------------------------------------- */
/* Main Edge Function                                                         */
/* -------------------------------------------------------------------------- */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        error: "Method not allowed",
      },
      405,
    );
  }

  try {
    /* ---------------------------------------------------------------------- */
    /* Environment                                                            */
    /* ---------------------------------------------------------------------- */

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const supabaseServiceKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
      );

    if (
      !supabaseUrl ||
      !supabaseServiceKey
    ) {
      console.error(
        "Supabase environment variables are missing",
      );

      return jsonResponse(
        {
          success: false,
          error:
            "Server configuration error",
        },
        500,
      );
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Authenticate                                                           */
    /* ---------------------------------------------------------------------- */

    const authHeader =
      req.headers.get("Authorization");

    if (
      !authHeader ||
      !authHeader.startsWith("Bearer ")
    ) {
      return jsonResponse(
        {
          success: false,
          error: "Unauthorized",
        },
        401,
      );
    }

    const accessToken =
      authHeader.substring(7).trim();

    if (!accessToken) {
      return jsonResponse(
        {
          success: false,
          error: "Unauthorized",
        },
        401,
      );
    }

    /*
     * process-scheduled-posts calls in with the service role key to publish
     * a due post on behalf of its author. Everyone else must be the author.
     */
    const isInternalCall =
      accessToken === supabaseServiceKey;

    let userId = "";

    if (!isInternalCall) {
      const {
        data: userData,
        error: authError,
      } = await supabase.auth.getUser(
        accessToken,
      );

      if (
        authError ||
        !userData?.user
      ) {
        console.error(
          "Authentication failed:",
          authError,
        );

        return jsonResponse(
          {
            success: false,
            error: "Unauthorized",
          },
          401,
        );
      }

      userId = userData.user.id;
    }

    /* ---------------------------------------------------------------------- */
    /* Parse request                                                          */
    /* ---------------------------------------------------------------------- */

    let body: PublishRequest;

    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        {
          success: false,
          error: "Invalid JSON body",
        },
        400,
      );
    }

    const postId =
      body.post_id?.trim();

    if (!postId) {
      return jsonResponse(
        {
          success: false,
          error: "Post ID required",
        },
        400,
      );
    }

    /* ---------------------------------------------------------------------- */
    /* Get owned post                                                         */
    /* ---------------------------------------------------------------------- */

    let postQuery = supabase
      .from("social_media_posts")
      .select(`
        id,
        created_by,
        content,
        media_urls,
        platforms,
        status,
        published_at,
        external_post_ids,
        external_post_url,
        updated_at,
        product_id
      `)
      .eq("id", postId);

    if (!isInternalCall) {
      postQuery = postQuery.eq("created_by", userId);
    }

    const {
      data: post,
      error: postError,
    } = await postQuery.single();

    if (
      postError ||
      !post
    ) {
      console.error(
        "Post lookup failed:",
        postError,
      );

      return jsonResponse(
        {
          success: false,
          error: "Post not found",
        },
        404,
      );
    }

    const socialPost = await withProductDetails(
      supabase,
      post as SocialPost,
    );

    // Tokens are always the author's own connections.
    userId = socialPost.created_by;

    /* ---------------------------------------------------------------------- */
    /* Determine platforms                                                    */
    /* ---------------------------------------------------------------------- */

    const requestedPlatforms =
      Array.isArray(body.platforms) &&
      body.platforms.length > 0
        ? body.platforms
        : Array.isArray(socialPost.platforms)
          ? socialPost.platforms
          : [];

    const targetPlatforms = [
      ...new Set(
        requestedPlatforms
          .map((p) => normalizePlatformName(p))
          .filter((p) => p && SUPPORTED_PLATFORMS.has(p)),
      ),
    ];

    // Platforms without API publishing (e.g. TikTok, YouTube) are reported as
    // failed for that platform instead of rejecting the whole request, so a
    // Facebook + TikTok post still goes out on Facebook.
    const unsupportedPlatforms = [
      ...new Set(
        requestedPlatforms
          .map((p) => normalizePlatformName(p))
          .filter((platform) => platform && !SUPPORTED_PLATFORMS.has(platform)),
      ),
    ];

    if (targetPlatforms.length === 0 && unsupportedPlatforms.length === 0) {
      return jsonResponse(
        {
          success: false,
          error: "At least one publishing platform is required",
        },
        400,
      );
    }

    /* ---------------------------------------------------------------------- */
    /* Existing external IDs                                                  */
    /* ---------------------------------------------------------------------- */

    const existingExternalIds =
      socialPost.external_post_ids &&
      typeof socialPost.external_post_ids ===
        "object"
        ? {
            ...socialPost.external_post_ids,
          }
        : {};

    const results: PlatformResult[] =
      unsupportedPlatforms.map((platform) => ({
        platform,
        success: false,
        error:
          `Automatic publishing to ${platform} is not supported yet. Post it manually, then add the post URL.`,
      }));

    const externalPostIds: Record<
      string,
      string
    > = {};

    /* ---------------------------------------------------------------------- */
    /* Publish each platform                                                  */
    /* ---------------------------------------------------------------------- */

    for (const platform of targetPlatforms) {
      /*
       * Idempotency protection:
       *
       * If this post was already successfully published to this
       * platform, don't create another duplicate publication.
       */
      if (isDuplicatePublish(existingExternalIds, platform)) {
        const duplicateExternalId = existingExternalIds[platform];

        results.push({
          platform,
          success: true,
          external_post_id: duplicateExternalId,
        });

        externalPostIds[platform] = duplicateExternalId;
        continue;
      }

      const tokenData =
        await getActiveToken(
          supabase,
          userId,
          platform,
        );

      if (!tokenData) {
        results.push({
          platform,
          success: false,
          error: platform === "instagram"
            ? "Instagram is not connected. Connect it under Accounts (it must be a Business or Creator account linked to your Facebook Page)."
            : `${platform} is not connected. Connect it under Accounts first.`,
        });

        continue;
      }

      try {
        console.log(
          `Publishing post ${postId} to ${platform}`,
        );

        const result =
          await publishPlatform(
            platform,
            socialPost,
            tokenData,
            supabase,
          );

        results.push(result);

        if (
          result.success &&
          result.external_post_id
        ) {
          externalPostIds[platform] =
            result.external_post_id;

          await updateTokenLastUsed(
            supabase,
            tokenData.id,
          );
        }
      } catch (error) {
        console.error(
          `Error publishing to ${platform}:`,
          error,
        );

        results.push({
          platform,
          success: false,
          error: errorMessage(error),
        });
      }
    }

    /* ---------------------------------------------------------------------- */
    /* Calculate final state                                                  */
    /* ---------------------------------------------------------------------- */

    const successCount =
      results.filter(
        (result) => result.success,
      ).length;

    const failureCount =
      results.filter(
        (result) => !result.success,
      ).length;

    const total =
      results.length;

    let overallStatus:
      | "failed"
      | "partial"
      | "published";

    if (successCount === 0) {
      overallStatus = "failed";
    } else if (
      successCount < total
    ) {
      overallStatus = "partial";
    } else {
      overallStatus = "published";
    }

    /*
     * Only set published_at when the entire requested operation
     * succeeded.
     *
     * A partial publication is NOT a fully published post.
     */
    const updatePayload: Record<
      string,
      unknown
    > = {
      status: overallStatus,
      external_post_ids: {
        ...existingExternalIds,
        ...externalPostIds,
      },
      updated_at:
        new Date().toISOString(),
    };

    // Keep a public link on the post; mining verification matches on it.
    const firstUrl = results.find(
      (result) => result.success && result.external_post_url,
    )?.external_post_url;
    if (!socialPost.external_post_url && firstUrl) {
      updatePayload.external_post_url = firstUrl;
    }

    // Keep the product photo on the post so the dashboard shows what went out.
    if (
      postMedia(socialPost).length === 0 &&
      socialPost.fallback_media?.length &&
      ["facebook", "instagram"].some((p) => externalPostIds[p] && !existingExternalIds[p])
    ) {
      updatePayload.media_urls = socialPost.fallback_media;
    }

    if (
      overallStatus === "published"
    ) {
      updatePayload.published_at =
        socialPost.published_at ||
        new Date().toISOString();
    }

    /* ---------------------------------------------------------------------- */
    /* Update post                                                            */
    /* ---------------------------------------------------------------------- */

    const {
      error: updateError,
    } = await supabase
      .from("social_media_posts")
      .update(updatePayload)
      .eq("id", postId)
      .eq("created_by", userId);

    if (updateError) {
      console.error(
        "Failed updating social media post:",
        updateError,
      );

      /*
       * Publication may already have happened externally.
       * Therefore we do NOT claim that the platforms failed.
       */
      return jsonResponse(
        {
          success: false,
          error:
            "Publication completed, but the local post status could not be updated",
          results,
          summary: {
            total,
            success: successCount,
            failed: failureCount,
          },
        },
        500,
      );
    }

    /* ---------------------------------------------------------------------- */
    /* Per-platform results (shown on the post in the dashboard)              */
    /* ---------------------------------------------------------------------- */

    const publishedAt = new Date().toISOString();
    const { error: platformsError } = await supabase
      .from("social_post_platforms")
      .upsert(
        results
          // Already-published platforms were skipped; keep their stored row.
          .filter((result) => !(result.success && existingExternalIds[result.platform]))
          .map((result) => ({
            post_id: postId,
            platform: result.platform,
            status: result.success ? "published" : "failed",
            external_post_id: result.external_post_id ?? null,
            external_post_url: result.external_post_url ?? null,
            error_message: result.success ? null : result.error ?? null,
            published_at: result.success ? publishedAt : null,
          })),
        { onConflict: "post_id,platform" },
      );

    if (platformsError) {
      // The post itself is already updated; this is only the detail view.
      console.error(
        "Failed recording per-platform results:",
        platformsError,
      );
    }

    /* ---------------------------------------------------------------------- */
    /* Response                                                               */
    /* ---------------------------------------------------------------------- */

    const summary = {
      total,
      success: successCount,
      failed: failureCount,
    };

    /* ---------------------------------------------------------------------- */
    /* Reward: once per post, the first time it goes live anywhere            */
    /* ---------------------------------------------------------------------- */

    let reward = 0;
    if (Object.keys(externalPostIds).some((p) => !existingExternalIds[p])) {
      const { data: amount, error: rewardError } = await supabase.rpc(
        "award_activity",
        {
          p_user_id: userId,
          p_activity_code: "post_published",
          p_idempotency_key: `post_published:${postId}`,
          p_reference_type: "social_media_post",
          p_reference_id: postId,
          p_title: "Published a post",
        },
      );
      if (rewardError) {
        console.error("post_published reward failed:", rewardError);
      } else {
        reward = Number(amount) || 0;
      }
    }

    return jsonResponse({
      success: successCount > 0,
      status: overallStatus,
      results,
      summary,
      reward,
    });
  } catch (error) {
    console.error(
      "Error in social-publish:",
      error,
    );

    return jsonResponse(
      {
        success: false,
        error: errorMessage(error),
      },
      500,
    );
  }
});