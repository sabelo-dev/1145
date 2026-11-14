/**
 * Plausible analytics, sent straight to its Events API instead of loading the
 * script: no extra download on the site, and it works in the Android/iOS apps,
 * whose WebView runs on https://localhost (the script ignores localhost).
 *
 * Events: pageview (every route), "Signup", "First Order", "Repeat Order" and
 * "Order" (guest checkout). Each carries `platform` (web / android / ios) and
 * the visitor's first-touch source (lib/attribution).
 *
 * Set up in Plausible: add the site (VITE_PLAUSIBLE_DOMAIN, default 1145.io),
 * then add the goals Signup, First Order, Repeat Order and Order (for revenue,
 * mark the order goals as revenue goals in ZAR).
 */
import { firstTouchProps } from "@/lib/attribution";

const DOMAIN = (import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined) ?? "1145.io";
const ENDPOINT = (import.meta.env.VITE_PLAUSIBLE_ENDPOINT as string | undefined) ?? "https://plausible.io/api/event";

type Platform = "web" | "android" | "ios";

// Read from the native bridge's global, so this file does not pull in Capacitor.
function platform(): Platform {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor;
  if (cap?.isNativePlatform?.()) return cap.getPlatform?.() === "ios" ? "ios" : "android";
  return "web";
}

/** Only the live site and the apps: not localhost, previews or merchants' custom domains. */
function enabled(): boolean {
  if (!DOMAIN || typeof window === "undefined") return false;
  if (platform() !== "web") return true;
  const host = window.location.hostname;
  return host === DOMAIN || host.endsWith(`.${DOMAIN}`);
}

// The apps' WebView URL is https://localhost/...; report the path on the real domain.
function pageUrl(): string {
  const { pathname, search, href } = window.location;
  return platform() === "web" ? href : `https://${DOMAIN}${pathname}${search}`;
}

interface EventOptions {
  props?: Record<string, string | number | boolean | null | undefined>;
  revenue?: { amount: number; currency: string };
}

export function plausibleEvent(name: string, { props = {}, revenue }: EventOptions = {}): Promise<void> {
  if (!enabled()) return Promise.resolve();
  const clean: Record<string, string> = {};
  const merged = name === "pageview" ? { platform: platform(), ...props } : { platform: platform(), ...firstTouchProps(), ...props };
  for (const [k, v] of Object.entries(merged as Record<string, unknown>)) if (v !== undefined && v !== null && v !== "") clean[k] = String(v).slice(0, 200);
  const body = {
    name,
    url: pageUrl(),
    domain: DOMAIN,
    referrer: document.referrer || null,
    props: clean,
    ...(revenue && revenue.amount > 0 ? { revenue } : {}),
  };
  // text/plain avoids a CORS preflight; keepalive lets it finish during a navigation.
  return fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(body), keepalive: true })
    .then(() => undefined)
    .catch(() => undefined);
}

export const plausiblePageview = () => plausibleEvent("pageview");
