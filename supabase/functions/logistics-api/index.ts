// 1145 Logistics: public business API (v1).
//
//   Authorization: Bearer lx_live_…        (created on the console's Developers page)
//
//   POST /v1/quote                          price + promise for a trip
//   POST /v1/shipments                      create (Idempotency-Key header supported)
//   GET  /v1/shipments?status=&limit=       list this key's shipments
//   GET  /v1/shipments/:tracking_number     one shipment + timeline
//   POST /v1/shipments/:tracking_number/cancel
//
// Addresses: { street, suburb?, city?, postal_code?, lat?, lng? }. Missing
// coordinates are geocoded server-side (GOOGLE_MAPS_API_KEY).
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, idempotency-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const GOOGLE_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") ?? Deno.env.get("GOOGLE_API_KEY") ?? "";
const TRACK_BASE = (Deno.env.get("LOGISTICS_TRACK_URL") || "https://logistics.1145.io/track").replace(/\/+$/, "");
const SERVICE_LEVELS = ["express", "same_day", "next_day", "standard"];
const SIZES = ["small", "medium", "large", "xl"];
const WINDOWS: Record<string, [string, string]> = { morning: ["08:00", "12:00"], afternoon: ["12:00", "17:00"], evening: ["17:00", "20:00"] };
const PUBLIC_FIELDS =
  "tracking_number, reference, status, service_level, delivery_window, requires_approval, approved_at, parcel_count, weight_kg, recipient_name, delivery_address, promised_by, picked_up_at, delivered_at, attempt_count, last_failure_reason, shipping_fee, created_at";

type Address = Record<string, unknown> & { lat?: number; lng?: number };

class ApiError extends Error {
  constructor(public status: number, public code: string, message?: string, public headers: Record<string, string> = {}) {
    super(message ?? code);
  }
}

function clientIp(req: Request): string | null {
  return (req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "").split(",")[0].trim() || null;
}

/** Exact IPv4/IPv6 match, or IPv4 CIDR (e.g. 203.0.113.0/24). */
function ipAllowed(ip: string | null, allow: string[]): boolean {
  if (!allow.length) return true;
  if (!ip) return false;
  const toInt = (v: string) => v.split(".").reduce((a, o) => (a << 8) + (Number(o) & 255), 0) >>> 0;
  return allow.some((rule) => {
    if (!rule.includes("/")) return rule === ip;
    const [base, bitsRaw] = rule.split("/");
    const bits = Number(bitsRaw);
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip) || !(bits >= 0 && bits <= 32)) return false;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (toInt(ip) & mask) === (toInt(base) & mask);
  });
}

async function rateHit(admin: SupabaseClient, bucket: string, limit: number, windowSeconds = 60): Promise<boolean> {
  const { data, error } = await admin.rpc("logistics_rate_hit", { p_bucket: bucket, p_limit: limit, p_window_seconds: windowSeconds });
  return error ? true : data !== false; // fail open on limiter errors, never on auth
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hasCoords(a: Address | null | undefined): boolean {
  return !!a && Number.isFinite(Number(a.lat)) && Number.isFinite(Number(a.lng));
}

async function geocode(a: Address): Promise<Address> {
  if (hasCoords(a)) return { ...a, lat: Number(a.lat), lng: Number(a.lng) };
  const line = [a.street, a.suburb, a.city, a.postal_code, "South Africa"].filter(Boolean).join(", ");
  if (!line || !GOOGLE_KEY) throw new ApiError(422, "address_not_geocoded", "Provide lat/lng for each address");
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(line)}&components=country:ZA&key=${GOOGLE_KEY}`,
  );
  const body = await res.json().catch(() => null);
  const loc = body?.results?.[0]?.geometry?.location;
  if (!loc) throw new ApiError(422, "address_not_geocoded", `Could not locate "${line}"`);
  return { ...a, lat: loc.lat, lng: loc.lng };
}

function requireAddress(v: unknown, field: string): Address {
  if (!v || typeof v !== "object" || !(v as Address).street) throw new ApiError(422, "invalid_address", `${field}.street is required`);
  const a = v as Address;
  const clean: Address = {};
  for (const k of ["street", "suburb", "city", "province", "postal_code", "lat", "lng"]) if (a[k] != null) clean[k] = a[k];
  clean.country = "South Africa";
  return clean;
}

async function authenticate(admin: SupabaseClient, req: Request) {
  const ip = clientIp(req);
  const reject = async () => {
    // Slow down key guessing: failed auth is limited per source IP.
    await rateHit(admin, `apiauthfail:${ip ?? "unknown"}`, 20, 300);
    return new ApiError(401, "invalid_api_key");
  };
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  // Pre-check (read-only) the failure counter for this IP's current 5-minute window.
  const windowStart = new Date(Math.floor(Date.now() / 300_000) * 300_000).toISOString();
  const { data: fails } = await admin
    .from("logistics_rate_counters")
    .select("hits")
    .eq("bucket", `apiauthfail:${ip ?? "unknown"}`)
    .eq("window_start", windowStart)
    .maybeSingle();
  if ((fails?.hits ?? 0) >= 20) throw new ApiError(429, "rate_limited", "Too many failed authentication attempts", { "Retry-After": "300" });
  if (!/^lx_(live|test)_[A-Za-z0-9]{32,}$/.test(token)) throw await reject();
  const { data: key } = await admin
    .from("logistics_api_keys")
    .select("id, name, default_hub_id, sender_name, sender_phone, pickup_address, revoked_at, expires_at, scopes, allowed_ips, rate_limit_per_min")
    .eq("key_hash", await sha256Hex(token))
    .maybeSingle();
  if (!key || key.revoked_at) throw await reject();
  if (key.expires_at && new Date(key.expires_at).getTime() < Date.now()) throw new ApiError(401, "api_key_expired");
  if (!ipAllowed(ip, key.allowed_ips ?? [])) throw new ApiError(403, "ip_not_allowed", `Requests from ${ip ?? "unknown IP"} are not allowed for this key`);
  if (!(await rateHit(admin, `api:${key.id}`, key.rate_limit_per_min ?? 120, 60))) {
    throw new ApiError(429, "rate_limited", `Limit is ${key.rate_limit_per_min} requests per minute`, { "Retry-After": "60" });
  }
  // Fire-and-forget usage stamp.
  admin.from("logistics_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id).then(() => undefined);
  return key;
}

async function quote(admin: SupabaseClient, pickup: Address, delivery: Address, size: string, service: string) {
  const { data, error } = await admin.rpc("quote_parcel", { p_pickup: pickup, p_delivery: delivery, p_size: size, p_service_level: service });
  if (error) throw new ApiError(422, error.message.match(/[a-z_]{6,}/)?.[0] ?? "quote_failed", error.message);
  return data as { fee: number; distance_km: number; promised_by: string };
}

const present = (s: Record<string, unknown>) => ({ ...s, tracking_url: `${TRACK_BASE}/${s.tracking_number}` });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const key = await authenticate(admin, req);
    // Path after the function name: /logistics-api/v1/...
    const path = new URL(req.url).pathname.replace(/^.*?\/logistics-api/, "").replace(/\/+$/, "") || "/";
    const parts = path.split("/").filter(Boolean); // ["v1", "shipments", ...]
    if (parts[0] !== "v1") throw new ApiError(404, "not_found", "Use /v1/…");
    const need = (scope: string) => {
      if (!(key.scopes ?? []).includes(scope)) throw new ApiError(403, "insufficient_scope", `This key lacks the ${scope} scope`);
    };
    const isWrite = req.method === "POST" && parts[1] === "shipments";
    if (parts[1] === "quote") need("quotes:read");
    else if (isWrite) need("shipments:write");
    else need("shipments:read");

    // POST /v1/quote
    if (req.method === "POST" && parts[1] === "quote" && parts.length === 2) {
      const b = await req.json().catch(() => ({}));
      const pickup = await geocode(b.pickup_address ? requireAddress(b.pickup_address, "pickup_address") : (key.pickup_address as Address));
      const delivery = await geocode(requireAddress(b.delivery_address, "delivery_address"));
      const size = SIZES.includes(b.size) ? b.size : "small";
      const service = SERVICE_LEVELS.includes(b.service_level) ? b.service_level : "next_day";
      return json({ ...(await quote(admin, pickup, delivery, size, service)), size, service_level: service });
    }

    // GET /v1/pickup-points?lat=&lng=
    if (req.method === "GET" && parts[1] === "pickup-points" && parts.length === 2) {
      const url = new URL(req.url);
      const lat = url.searchParams.get("lat");
      const lng = url.searchParams.get("lng");
      const { data } = await admin.rpc("list_pickup_points", { p_lat: lat ? Number(lat) : null, p_lng: lng ? Number(lng) : null, p_limit: 20 });
      return json({ data: data ?? [] });
    }

    if (parts[1] !== "shipments") throw new ApiError(404, "not_found");

    // POST /v1/shipments
    if (req.method === "POST" && parts.length === 2) {
      const idem = req.headers.get("Idempotency-Key")?.slice(0, 100) || null;
      if (idem) {
        const { data: existing } = await admin
          .from("shipments")
          .select(PUBLIC_FIELDS)
          .eq("api_key_id", key.id)
          .eq("metadata->>idempotency_key", idem)
          .maybeSingle();
        if (existing) return json(present(existing), 200);
      }

      const b = await req.json().catch(() => null);
      if (!b) throw new ApiError(400, "invalid_json");
      const recipient = b.recipient ?? {};
      if (!recipient.name || !recipient.phone) throw new ApiError(422, "invalid_recipient", "recipient.name and recipient.phone are required");
      const service = b.service_level ?? "next_day";
      if (!SERVICE_LEVELS.includes(service)) throw new ApiError(422, "invalid_service_level", `One of ${SERVICE_LEVELS.join(", ")}`);
      const size = SIZES.includes(b.size) ? b.size : "small";
      const pickupSrc = b.pickup_address ? requireAddress(b.pickup_address, "pickup_address") : (key.pickup_address as Address | null);
      if (!pickupSrc) throw new ApiError(422, "invalid_address", "pickup_address is required (or set a default on the API key)");
      // Deliver to a collection point instead of a door.
      let point: { id: string; name: string; address: Address; lat: number; lng: number } | null = null;
      if (b.pickup_point_code) {
        const { data: hub } = await admin
          .from("logistics_hubs")
          .select("id, name, address, lat, lng")
          .eq("code", String(b.pickup_point_code).toUpperCase())
          .eq("is_active", true)
          .eq("is_public", true)
          .in("hub_type", ["pickup_point", "locker"])
          .maybeSingle();
        if (!hub || hub.lat == null) throw new ApiError(422, "invalid_pickup_point", "Unknown pickup_point_code (see GET /v1/pickup-points)");
        if (service === "express") throw new ApiError(422, "invalid_service_level", "express is not available to pickup points");
        point = hub;
      }
      const [pickup, delivery] = await Promise.all([
        geocode(pickupSrc),
        point
          ? Promise.resolve({ ...(point.address ?? {}), lat: Number(point.lat), lng: Number(point.lng), pickup_point: point.name } as Address)
          : geocode(requireAddress(b.delivery_address, "delivery_address")),
      ]);
      const q = await quote(admin, pickup, delivery, size, service);
      // Optional window for planned services: promise the end of the window on the promised day (SAST).
      const window = ["next_day", "standard"].includes(service) && WINDOWS[b.delivery_window] ? b.delivery_window : "any";
      if (b.delivery_window && b.delivery_window !== "any" && window === "any") {
        throw new ApiError(422, "invalid_delivery_window", "delivery_window (morning|afternoon|evening) applies to next_day and standard only");
      }
      let promisedBy = q.promised_by;
      if (window !== "any") {
        const day = new Date(new Date(q.promised_by).getTime() + 2 * 3_600_000).toISOString().slice(0, 10);
        promisedBy = new Date(`${day}T${WINDOWS[window][1]}:00+02:00`).toISOString();
      }

      const { data: created, error } = await admin
        .from("shipments")
        .insert({
          api_key_id: key.id,
          source: "api",
          reference: b.reference ? String(b.reference).slice(0, 80) : null,
          sender_name: b.sender?.name ?? key.sender_name ?? key.name,
          sender_phone: b.sender?.phone ?? key.sender_phone ?? null,
          recipient_name: String(recipient.name).slice(0, 120),
          recipient_phone: String(recipient.phone).slice(0, 30),
          recipient_email: recipient.email ? String(recipient.email).slice(0, 200) : null,
          pickup_address: pickup,
          delivery_address: delivery,
          origin_hub_id: key.default_hub_id,
          service_level: service,
          status: "awaiting_pickup",
          parcel_count: Math.min(Math.max(Number(b.parcel_count) || 1, 1), 50),
          weight_kg: b.weight_kg != null ? Number(b.weight_kg) : null,
          declared_value: b.declared_value != null ? Number(b.declared_value) : null,
          cod_amount: b.cod_amount != null ? Number(b.cod_amount) : null,
          require_otp: b.require_otp !== false,
          shipping_fee: point ? Math.round(q.fee * 0.8) : q.fee,
          payment_status: "unpaid",
          promised_by: promisedBy,
          delivery_window: point ? "any" : window,
          destination_hub_id: point?.id ?? null,
          notes: b.notes ? String(b.notes).slice(0, 500) : null,
          metadata: { idempotency_key: idem, size, api_key_name: key.name },
        })
        .select(PUBLIC_FIELDS)
        .single();
      if (error) {
        const credit = ["account_on_hold", "account_overdue", "credit_limit_exceeded"].find((c) => error.message.includes(c));
        if (credit) throw new ApiError(402, credit, "Your 1145 Logistics account cannot book new shipments. Contact accounts.");
        throw new ApiError(400, "create_failed", error.message);
      }
      return json(present(created), 201);
    }

    // GET /v1/shipments
    if (req.method === "GET" && parts.length === 2) {
      const url = new URL(req.url);
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);
      let q = admin.from("shipments").select(PUBLIC_FIELDS).eq("api_key_id", key.id).order("created_at", { ascending: false }).limit(limit);
      const status = url.searchParams.get("status");
      if (status) q = q.eq("status", status);
      const since = url.searchParams.get("since");
      if (since) q = q.gte("updated_at", since);
      const { data, error } = await q;
      if (error) throw new ApiError(400, "query_failed", error.message);
      return json({ data: (data ?? []).map(present) });
    }

    const tn = (parts[2] ?? "").toUpperCase();
    const { data: ship } = await admin
      .from("shipments")
      .select(`id, ${PUBLIC_FIELDS}`)
      .eq("api_key_id", key.id)
      .eq("tracking_number", tn)
      .maybeSingle();
    if (!ship) throw new ApiError(404, "shipment_not_found");

    // GET /v1/shipments/:tn
    if (req.method === "GET" && parts.length === 3) {
      const { data: events } = await admin
        .from("shipment_events")
        .select("status, event_type, notes, created_at")
        .eq("shipment_id", ship.id)
        .neq("event_type", "note")
        .order("created_at");
      const { id: _id, ...rest } = ship;
      return json({ ...present(rest), events: events ?? [] });
    }

    // GET /v1/shipments/:tn/pod → proof of delivery with 10-minute signed links
    if (req.method === "GET" && parts.length === 4 && parts[3] === "pod") {
      const [{ data: stop }, { data: job }, { data: ev }] = await Promise.all([
        admin.from("route_stops").select("proof, completed_at").eq("shipment_id", ship.id).eq("stop_type", "delivery").eq("status", "completed").order("completed_at", { ascending: false }).limit(1).maybeSingle(),
        admin.from("shipments").select("delivery_jobs(proof), collected_at, require_otp, parcel_count, pii_redacted_at").eq("id", ship.id).maybeSingle(),
        admin.from("shipment_events").select("lat, lng, notes, created_at").eq("shipment_id", ship.id).eq("status", "delivered").eq("event_type", "status_change").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (ship.status !== "delivered") throw new ApiError(409, "not_delivered", `Shipment is ${ship.status}`);
      const proof = (stop?.proof ?? (job as any)?.delivery_jobs?.proof ?? {}) as Record<string, any>;
      const sign = async (path?: string) => {
        if (!path) return null;
        const { data } = await admin.storage.from("delivery-proofs").createSignedUrl(path, 600);
        return data?.signedUrl ?? null;
      };
      return json({
        tracking_number: tn,
        delivered_at: ship.delivered_at,
        method: job?.collected_at ? "collection_point" : proof.method ?? "name",
        received_by: proof.received_by ?? null,
        otp_verified: !!job?.require_otp,
        pieces_scanned: proof.pieces_scanned ?? null,
        pieces_total: proof.pieces_total ?? job?.parcel_count ?? null,
        location: ev?.lat != null ? { lat: Number(ev.lat), lng: Number(ev.lng) } : null,
        photo_url: await sign(proof.photo_path),
        signature_url: await sign(proof.signature_path),
        redacted: !!job?.pii_redacted_at,
      });
    }

    // POST /v1/shipments/:tn/return   { reason }
    if (req.method === "POST" && parts.length === 4 && parts[3] === "return") {
      const b = await req.json().catch(() => ({}));
      const { data, error } = await admin.rpc("logistics_create_return", {
        p_shipment_id: ship.id,
        p_reason: String(b.reason ?? "").slice(0, 300) || "Merchant-initiated return",
        p_initiator: "api",
      });
      if (error) throw new ApiError(400, "return_failed", error.message);
      if (!data?.ok) throw new ApiError(409, data?.error ?? "not_returnable");
      return json({ tracking_number: data.tracking_number, fee: data.fee, return_of: tn }, 201);
    }

    // POST /v1/shipments/:tn/cancel
    if (req.method === "POST" && parts.length === 4 && parts[3] === "cancel") {
      if (!["created", "awaiting_pickup", "at_hub"].includes(ship.status)) throw new ApiError(409, "not_cancellable", `Shipment is ${ship.status}`);
      const { data: onRoad } = await admin
        .from("route_stops")
        .select("id, delivery_routes!inner(status)")
        .eq("shipment_id", ship.id)
        .in("delivery_routes.status", ["dispatched", "in_progress"])
        .limit(1);
      if (onRoad?.length) throw new ApiError(409, "not_cancellable", "Shipment is already on a dispatched route");
      await admin.from("route_stops").update({ status: "skipped", failure_reason: "Cancelled via API" }).eq("shipment_id", ship.id).eq("status", "pending");
      const { error } = await admin.from("shipments").update({ status: "cancelled" }).eq("id", ship.id);
      if (error) throw new ApiError(400, "cancel_failed", error.message);
      return json({ tracking_number: tn, status: "cancelled" });
    }

    throw new ApiError(404, "not_found");
  } catch (err) {
    if (err instanceof ApiError) {
      const res = json({ error: { code: err.code, message: err.message } }, err.status);
      Object.entries(err.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    console.error("logistics-api", err);
    return json({ error: { code: "internal_error", message: "Unexpected error" } }, 500);
  }
});
