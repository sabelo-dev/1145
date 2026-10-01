import { supabase } from "@/integrations/supabase/client";
import { APP_LINK_BASE, getAppUrl } from "@/lib/appUrl";
import { isNative, openExternal } from "@/lib/native";

/** Platforms connected through a real provider login instead of a typed handle. */
export const OAUTH_PLATFORMS = new Set(["facebook", "instagram", "tiktok"]);

/**
 * Start the provider login for a social account (via the social-oauth edge
 * function) and come back to the current page afterwards. The callback stores
 * the verified account, so it shows up as connected on return.
 */
export async function startSocialOAuth(platform: string): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  ["success", "error", "platform", "reward"].forEach((key) => params.delete(key));
  const query = params.toString();
  const returnPath = `${window.location.pathname}${query ? `?${query}` : ""}`;

  const search = new URLSearchParams({
    action: "get_auth_url",
    platform,
    // In the native app the provider sends the user back through the app link.
    app_url: isNative() ? APP_LINK_BASE : getAppUrl("/"),
    return_path: returnPath,
  });

  const { data, error } = await supabase.functions.invoke(`social-oauth?${search.toString()}`, {
    method: "GET",
  });
  if (error) throw new Error(error.message || "Could not start the connection");
  if (!data?.auth_url) throw new Error(data?.error || "Could not start the connection");

  await openExternal(data.auth_url);
}
