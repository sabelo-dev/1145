// Shared dropshipping backend helpers: adapter resolution, FX, audit + logging.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CJAdapter } from "./cj.ts";
import type { SupplierAdapter } from "./types.ts";

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
}

export interface SupplierRow {
  id: string;
  code: string;
  name: string;
  adapter: string;
  status: string;
  health: string;
  base_currency: string;
  safety_stock: number;
  pricing_rule: Record<string, unknown>;
  shipping_rule: Record<string, unknown>;
  sync_intervals: Record<string, unknown>;
  auto_price_update: boolean;
  consecutive_failures: number;
  config: Record<string, unknown>;
}

/** Builds the correct adapter for a supplier row. Credentials are read from
 *  edge-function secrets only — never from the database. */
export function getAdapter(db: SupabaseClient, supplier: SupplierRow): SupplierAdapter {
  const log = (entry: Record<string, unknown>) => {
    db.from("dropship_api_logs")
      .insert({ supplier_id: supplier.id, ...entry })
      .then(() => {}, () => {});
  };

  switch (supplier.adapter) {
    case "cjdropshipping": {
      const email = Deno.env.get("CJ_EMAIL");
      const apiKey = Deno.env.get("CJ_API_KEY");
      if (!email || !apiKey) throw new Error("CJdropshipping credentials are not configured");
      return new CJAdapter(email, apiKey, log as never);
    }
    default:
      throw new Error(`No adapter registered for "${supplier.adapter}"`);
  }
}

export async function getSupplier(db: SupabaseClient, idOrCode: string): Promise<SupplierRow> {
  const isUuid = /^[0-9a-f-]{36}$/i.test(idOrCode);
  const { data, error } = await db
    .from("dropship_suppliers")
    .select("*")
    .eq(isUuid ? "id" : "code", idOrCode)
    .maybeSingle();
  if (error || !data) throw new Error("Supplier not found");
  return data as SupplierRow;
}

const FX_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/** Pulls live USD-based rates from a public FX feed and caches them locally. */
export async function refreshFxRates(db: SupabaseClient, codes: string[] = ["ZAR"]): Promise<void> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!res.ok) return;
    const payload = await res.json();
    const rates = payload?.rates || {};
    const rows = codes
      .filter((c) => Number(rates[c]) > 0)
      .map((c) => ({
        currency_code: c,
        rate_to_usd: Number(rates[c]),
        updated_at: new Date().toISOString(),
      }));
    if (rows.length) await db.from("currency_rates").upsert(rows, { onConflict: "currency_code" });
  } catch (_err) {
    // Never block pricing on an FX feed outage — cached/fallback rates are used.
  }
}

/** USD -> ZAR using the platform currency table, auto-refreshed when stale. */
export async function getFxRate(db: SupabaseClient, from = "USD", to = "ZAR"): Promise<number> {
  if (from === to) return 1;
  const codes = [from, to].filter((c) => c !== "USD");

  const read = async () => {
    const { data } = await db
      .from("currency_rates")
      .select("currency_code, rate_to_usd, updated_at")
      .in("currency_code", [from, to]);
    return data || [];
  };

  let data = await read();
  const stale = codes.some((code) => {
    const row = data.find((r) => r.currency_code === code);
    if (!row || !Number(row.rate_to_usd)) return true;
    const age = Date.now() - new Date(row.updated_at as string).getTime();
    return !(age < FX_MAX_AGE_MS);
  });
  if (stale) {
    await refreshFxRates(db, codes);
    data = await read();
  }

  const rate = (code: string) => Number(data.find((r) => r.currency_code === code)?.rate_to_usd ?? 0);
  const fromRate = from === "USD" ? 1 : rate(from);
  const toRate = to === "USD" ? 1 : rate(to);
  if (!fromRate || !toRate) return to === "ZAR" ? 18.5 : 1;
  return toRate / fromRate;
}

export async function audit(
  db: SupabaseClient,
  entry: {
    actor_id?: string | null;
    actor_role?: string;
    action: string;
    entity_type: string;
    entity_id?: string | null;
    previous_state?: unknown;
    new_state?: unknown;
    metadata?: Record<string, unknown>;
  },
) {
  await db.from("dropship_audit_log").insert({
    actor_id: entry.actor_id ?? null,
    actor_role: entry.actor_role ?? "system",
    action: entry.action,
    entity_type: entry.entity_type,
    entity_id: entry.entity_id ?? null,
    previous_state: entry.previous_state ?? null,
    new_state: entry.new_state ?? null,
    metadata: entry.metadata ?? {},
  });
}

export async function notify(
  db: SupabaseClient,
  userId: string,
  type: string,
  title: string,
  message: string,
) {
  await db.from("user_notifications").insert({ user_id: userId, type, title, message });
}

export async function notifyAdmins(db: SupabaseClient, type: string, title: string, message: string) {
  const { data } = await db.from("user_roles").select("user_id").eq("role", "admin");
  if (!data?.length) return;
  await db.from("user_notifications").insert(
    data.map((r) => ({ user_id: r.user_id, type, title, message })),
  );
}

export async function recordHealth(
  db: SupabaseClient,
  supplier: SupplierRow,
  ok: boolean,
  message?: string,
) {
  const failures = ok ? 0 : (supplier.consecutive_failures || 0) + 1;
  const health = ok ? "healthy" : failures >= 3 ? "offline" : "degraded";
  await db
    .from("dropship_suppliers")
    .update({
      health,
      consecutive_failures: failures,
      last_health_check_at: new Date().toISOString(),
      last_error: ok ? null : message ?? null,
    })
    .eq("id", supplier.id);
  if (!ok && failures === 3) {
    await notifyAdmins(
      db,
      "dropship_supplier_offline",
      `${supplier.name} is offline`,
      `Repeated failures contacting ${supplier.name}. Supplier operations are paused.`,
    );
  }
  return health;
}

/** Authenticated caller helper: returns the user id, or null. */
export async function getCaller(req: Request): Promise<{ id: string; token: string } | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const client = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: auth } }, auth: { persistSession: false } },
  );
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, token };
}

export async function isAdmin(db: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await db.rpc("has_role", { _user_id: userId, _role: "admin" });
  return data === true;
}

/** Simple per-user sliding-window rate limit backed by the api log table. */
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, limit = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}
