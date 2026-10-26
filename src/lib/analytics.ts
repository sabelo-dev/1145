import { supabase } from "@/integrations/supabase/client";

/**
 * Funnel events for the Growth Command Centre (table growth_events).
 * Fire-and-forget: events are batched, sent off the critical path, and a
 * failure (offline, table not migrated yet) is dropped silently — analytics
 * must never break a page.
 */
export type GrowthEvent =
  | "home_impression"
  | "category_click"
  | "search"
  | "product_view"
  | "download_click"
  | "merchant_apply_click"
  | "merchant_application"
  | "add_to_cart"
  | "checkout_start"
  | "purchase"
  | "campaign_click"
  | "referral_click"
  | "creator_click"
  | "area_selected";

type Props = Record<string, string | number | boolean | null | undefined>;

const SESSION_KEY = "1145:growth-session";
const AREA_KEY = "1145:delivery-area";
const FLUSH_MS = 2_000;

let queue: Array<Record<string, unknown>> = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let disabled = false;

function sessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "nostorage";
  }
}

function currentArea(): string | null {
  try {
    const raw = localStorage.getItem(AREA_KEY);
    return raw ? (JSON.parse(raw)?.label ?? null) : null;
  } catch {
    return null;
  }
}

async function flush() {
  timer = null;
  if (!queue.length || disabled) return;
  const batch = queue;
  queue = [];
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id ?? null;
    // Table is newer than the generated types, hence the cast.
    const table = (supabase.from as unknown as (name: string) => {
      insert: (rows: unknown[]) => Promise<{ error: { code?: string; message: string } | null }>;
    })("growth_events");
    const { error } = await table.insert(batch.map((row) => ({ ...row, user_id: uid })));
    // A missing table means the migration hasn't run here; stop trying this session.
    if (error && /growth_events|42P01|PGRST205/.test(`${error.code} ${error.message}`)) disabled = true;
  } catch {
    // Offline or blocked: drop the batch.
  }
}

export function track(event: GrowthEvent, props: Props = {}): void {
  if (disabled || typeof window === "undefined") return;
  const clean: Props = {};
  for (const [k, v] of Object.entries(props)) if (v !== undefined) clean[k] = typeof v === "string" ? v.slice(0, 120) : v;
  queue.push({
    event,
    session_id: sessionId(),
    path: window.location.pathname.slice(0, 300),
    area: currentArea(),
    props: clean,
  });
  if (!timer) timer = setTimeout(flush, FLUSH_MS);
}

// Send what's queued when the tab is hidden, so exits still count.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && queue.length) {
      if (timer) clearTimeout(timer);
      void flush();
    }
  });
}

const INTERESTS_KEY = "1145:interests";

/** Remembers the categories a visitor views (on this device) for "Recommended for you". */
export function rememberInterest(category: string | undefined | null): void {
  if (!category) return;
  try {
    const list: string[] = JSON.parse(localStorage.getItem(INTERESTS_KEY) || "[]");
    const next = [category, ...list.filter((c) => c !== category)].slice(0, 5);
    localStorage.setItem(INTERESTS_KEY, JSON.stringify(next));
  } catch { /* storage unavailable */ }
}

export function recentInterests(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(INTERESTS_KEY) || "[]");
    return Array.isArray(list) ? list.filter((c): c is string => typeof c === "string") : [];
  } catch {
    return [];
  }
}
