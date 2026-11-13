/**
 * Carries "where to go after signing in" through login → register → verify-email,
 * so a shopper sent to sign in from checkout lands back on checkout.
 */

/**
 * Returns the path only if it stays on this site; otherwise null. Accepts a
 * string or a router Location ({ pathname, search, hash }), since route guards
 * pass `state={{ from: location }}`; anything else is ignored.
 */
export function safeRedirect(value: unknown): string | null {
  let path: unknown = value;
  if (value && typeof value === "object" && typeof (value as { pathname?: unknown }).pathname === "string") {
    const loc = value as { pathname: string; search?: unknown; hash?: unknown };
    path = loc.pathname + (typeof loc.search === "string" ? loc.search : "") + (typeof loc.hash === "string" ? loc.hash : "");
  }
  if (typeof path !== "string" || !path) return null;
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") ? path : null;
}

/** Appends `redirect=<target>` to a path when there is a target. */
export function withRedirect(path: string, redirect: string | null | undefined): string {
  const target = safeRedirect(redirect);
  if (!target) return path;
  return `${path}${path.includes("?") ? "&" : "?"}redirect=${encodeURIComponent(target)}`;
}
