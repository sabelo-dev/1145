import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptToken } from "../_shared/socialCrypto.ts";

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

// Keep the Meta version configurable so the function does not require
// a code deployment every time Meta changes the supported version.
const META_GRAPH_VERSION =
  Deno.env.get("META_GRAPH_VERSION") || "v26.0";

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
  updated_at?: string | null;
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
  const message = post.content?.trim() || "";
  const mediaUrls = Array.isArray(post.media_urls)
    ? post.media_urls.filter(Boolean)
    : [];

  if (!message && mediaUrls.length === 0) {
    throw new Error(
      "Facebook post must contain text or media",
    );
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
      `https://www.facebook.com/${data.id}`,
  };
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
): Promise<void> {
  for (let attempt = 0; attempt < INSTAGRAM_MAX_POLLS; attempt++) {
    const response = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${containerId}?` +
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
  caption?: string,
  carouselItem = false,
): Promise<string> {
  const video = isVideoUrl(mediaUrl);

  const body: Record<string, unknown> = {
    access_token: accessToken,
  };

  if (video) {
    body.video_url = mediaUrl;
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
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${igAccountId}/media`,
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
  );

  return containerId;
}

async function publishInstagramContainer(
  igAccountId: string,
  accessToken: string,
  creationId: string,
): Promise<string> {
  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${igAccountId}/media_publish`,
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
  const accessToken = await decryptIfNecessary(
    tokenData.page_access_token ||
      tokenData.access_token,
  );

  const igAccountId = tokenData.account_id;

  if (!igAccountId) {
    throw new Error(
      "Instagram Business/Creator account is not connected",
    );
  }

  const mediaUrls = Array.isArray(post.media_urls)
    ? post.media_urls.filter(Boolean)
    : [];

  if (mediaUrls.length === 0) {
    return {
      platform: "instagram",
      success: false,
      error:
        "Instagram publishing requires at least one image or video",
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
        post.content?.trim() || undefined,
      );

    const publishedId =
      await publishInstagramContainer(
        igAccountId,
        accessToken,
        containerId,
      );

    return {
      platform: "instagram",
      success: true,
      external_post_id: publishedId,
      external_post_url:
        `https://www.instagram.com/p/${publishedId}/`,
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
      );

    children.push(childId);
  }

  if (children.length !== mediaUrls.length) {
    throw new Error(
      "Instagram carousel media creation was incomplete",
    );
  }

  const carouselResponse = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${igAccountId}/media`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        media_type: "CAROUSEL",
        children,
        caption: post.content?.trim() || "",
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
  );

  const publishedId =
    await publishInstagramContainer(
      igAccountId,
      accessToken,
      carouselData.id,
    );

  return {
    platform: "instagram",
    success: true,
    external_post_id: publishedId,
    external_post_url:
      `https://www.instagram.com/p/${publishedId}/`,
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

  const text = post.content?.trim() || "";

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

  const text = post.content?.trim() || "";

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
      return await publishToInstagram(
        post,
        supabase
          ? await ensureFacebookPage(supabase, tokenData)
          : tokenData,
      );

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

    const userId =
      userData.user.id;

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

    const {
      data: post,
      error: postError,
    } = await supabase
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
        updated_at
      `)
      .eq("id", postId)
      .eq("created_by", userId)
      .single();

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

    const socialPost =
      post as SocialPost;

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

    const unsupportedPlatforms = requestedPlatforms
      .map((p) => normalizePlatformName(p))
      .filter((platform) => platform && !SUPPORTED_PLATFORMS.has(platform));

    if (unsupportedPlatforms.length > 0) {
      return jsonResponse(
        {
          success: false,
          error: "Unsupported platform(s)",
          platforms: unsupportedPlatforms,
        },
        400,
      );
    }

    if (targetPlatforms.length === 0) {
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
      [];

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
          error:
            "No active connected account for this platform",
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
      targetPlatforms.length;

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
    /* Response                                                               */
    /* ---------------------------------------------------------------------- */

    const summary = {
      total,
      success: successCount,
      failed: failureCount,
    };

    return jsonResponse({
      success: successCount > 0,
      status: overallStatus,
      results,
      summary,
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