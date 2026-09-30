import { supabase } from "@/integrations/supabase/client";
import { getAppUrl } from "@/lib/appUrl";

/** Platforms connected through a real provider login instead of a typed handle. */
export const OAUTH_PLATFORMS = new Set(["facebook", "instagram"]);

/**
 * Start the provider login for a social account (via the social-oauth edge
 * function) and come back to the current page afterwards. The callback stores
 * the verified account, so it shows up as connected on return.
 */
export async function startSocialOAuth(platform: string): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  ["success", "error", "platform"].forEach((key) => params.delete(key));
  const query = params.toString();
  const returnPath = `${window.location.pathname}${query ? `?${query}` : ""}`;

  const search = new URLSearchParams({
    action: "get_auth_url",
    platform,
    app_url: getAppUrl("/"),
    return_path: returnPath,
  });

  const { data, error } = await supabase.functions.invoke(`social-oauth?${search.toString()}`, {
    method: "GET",
  });
  if (error) throw new Error(error.message || "Could not start the connection");
  if (!data?.auth_url) throw new Error(data?.error || "Could not start the connection");

  window.location.href = data.auth_url;
}
