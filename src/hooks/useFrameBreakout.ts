import { useEffect } from "react";

/**
 * Breaks out of an iframe by promoting the current URL to the top-level window.
 *
 * Auth flows (login, register, password reset, OAuth callbacks, email confirmation)
 * frequently redirect to the configured SITE_URL (e.g. https://1145.io).
 * When the app is rendered inside the Lovable preview iframe (a different origin),
 * the browser blocks that navigation with a `chrome-error://chromewebdata/` failure.
 *
 * Promoting auth pages to the top frame keeps origins consistent so redirects work.
 *
 * @param enabled - set to false to opt out (e.g. when intentionally embedded)
 */
export const useFrameBreakout = (enabled: boolean = true) => {
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    try {
      const inIframe = window.self !== window.top;
      if (!inIframe) return;

      // Skip breakout in known dev/preview sandboxes so contributors can keep
      // testing inside the Lovable editor. Only break out on production hosts.
      const host = window.location.hostname;
      const isPreview =
        host.endsWith(".lovable.app") ||
        host.endsWith(".lovableproject.com") ||
        host.endsWith(".lovable.dev") ||
        host === "localhost" ||
        host === "127.0.0.1";

      if (isPreview) return;

      // Promote to top frame - this prevents cross-origin redirect failures
      // when Supabase / OAuth providers send users to SITE_URL.
      window.top!.location.href = window.location.href;
    } catch {
      // Cross-origin access to window.top throws; that itself confirms we're
      // framed by a foreign origin. Force a top-level navigation via _top.
      try {
        const a = document.createElement("a");
        a.href = window.location.href;
        a.target = "_top";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch {
        /* no-op */
      }
    }
  }, [enabled]);
};
