/**
 * First-touch attribution: the UTM tags (or referring site) of the visit that
 * first brought this browser to 1145. A signup or order often happens on a
 * later visit, so analytics events carry where the visitor originally came from.
 */

const KEY = "1145:first-touch";
const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;

interface FirstTouch {
  source: string;
  medium?: string;
  campaign?: string;
  content?: string;
  landing: string;
  at: string;
}

/** Call once per page load: remembers the first visit's source, never overwrites it. */
export function captureAttribution(): void {
  try {
    if (localStorage.getItem(KEY)) return;
    const params = new URLSearchParams(window.location.search);
    const tags = Object.fromEntries(UTM.map((k) => [k, params.get(k)?.slice(0, 100) || undefined]));
    let source = tags.utm_source;
    if (!source && document.referrer) {
      const ref = new URL(document.referrer).hostname.replace(/^www\./, "");
      if (ref && !/(^|\.)1145\.io$/.test(ref)) source = ref;
    }
    const touch: FirstTouch = {
      source: source || "direct",
      medium: tags.utm_medium,
      campaign: tags.utm_campaign,
      content: tags.utm_content,
      landing: window.location.pathname.slice(0, 100),
      at: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(touch));
  } catch {
    // Storage blocked: attribution is best-effort.
  }
}

/** The first visit's source as event props (first_source, first_medium, first_campaign). */
export function firstTouchProps(): Record<string, string> {
  try {
    const touch = JSON.parse(localStorage.getItem(KEY) || "null") as FirstTouch | null;
    if (!touch) return {};
    const out: Record<string, string> = { first_source: touch.source };
    if (touch.medium) out.first_medium = touch.medium;
    if (touch.campaign) out.first_campaign = touch.campaign;
    return out;
  } catch {
    return {};
  }
}
