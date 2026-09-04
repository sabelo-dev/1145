// Turns a supplier shipment into a 1145 driver job.
// A parcel that has left the supplier still needs a local courier for the final
// leg, so once a fulfilment ships we create exactly one delivery job with
// pickup and drop-off coordinates that drivers can navigate to.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface GeoPoint {
  lat: number | null;
  lng: number | null;
}

const DEFAULT_HUB = {
  label: "1145 Lifestyle Distribution Hub",
  street: "1 Jan Smuts Avenue",
  city: "Johannesburg",
  province: "Gauteng",
  postal_code: "2196",
  country: "South Africa",
  lat: -26.1715,
  lng: 28.0342,
};

/** Google Geocoding — returns nulls instead of throwing so a lookup failure
 *  never blocks a delivery job from being created. */
export async function geocode(address: string): Promise<GeoPoint> {
  const key = Deno.env.get("GOOGLE_API_KEY") || Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!key || !address.trim()) return { lat: null, lng: null };
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=za&key=${key}`,
    );
    const data = await res.json();
    const loc = data?.results?.[0]?.geometry?.location;
    if (loc && typeof loc.lat === "number" && typeof loc.lng === "number") {
      return { lat: loc.lat, lng: loc.lng };
    }
  } catch {
    /* ignore — address string still routes in the driver app */
  }
  return { lat: null, lng: null };
}

export function formatAddress(addr: Record<string, any>): string {
  return [
    addr.street || addr.address_line1 || addr.line1,
    addr.suburb || addr.address_line2,
    addr.city,
    addr.province || addr.state,
    addr.postal_code || addr.zip,
    addr.country || "South Africa",
  ].filter(Boolean).join(", ");
}

function haversineKm(a: GeoPoint, b: GeoPoint): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.asin(Math.sqrt(s)) * 10) / 10;
}

/** Local pickup point for imported parcels (configurable in platform settings). */
async function getHub(db: SupabaseClient) {
  const { data } = await db
    .from("platform_settings")
    .select("value")
    .eq("key", "dropship_pickup_hub")
    .maybeSingle();
  const v = (data?.value ?? {}) as Record<string, any>;
  return {
    label: v.label || DEFAULT_HUB.label,
    street: v.street || DEFAULT_HUB.street,
    city: v.city || DEFAULT_HUB.city,
    province: v.province || DEFAULT_HUB.province,
    postal_code: v.postal_code || DEFAULT_HUB.postal_code,
    country: v.country || DEFAULT_HUB.country,
    lat: typeof v.lat === "number" ? v.lat : DEFAULT_HUB.lat,
    lng: typeof v.lng === "number" ? v.lng : DEFAULT_HUB.lng,
  };
}

/**
 * Creates (or refreshes) the driver job for a supplier shipment.
 * Idempotent: one job per order, one per fulfilment.
 */
export async function ensureDeliveryJob(
  db: SupabaseClient,
  fulfillment: { id: string; order_id: string; shipping_address?: Record<string, any> | null; tracking_number?: string | null; carrier?: string | null },
): Promise<{ created: boolean; job_id: string | null; reason?: string }> {
  const { data: existing } = await db
    .from("delivery_jobs")
    .select("id")
    .or(`fulfillment_id.eq.${fulfillment.id},order_id.eq.${fulfillment.order_id}`)
    .maybeSingle();
  if (existing) {
    await db.from("delivery_jobs").update({ fulfillment_id: fulfillment.id }).eq("id", existing.id);
    return { created: false, job_id: existing.id };
  }

  const { data: order } = await db
    .from("orders")
    .select("id, shipping_address, total")
    .eq("id", fulfillment.order_id)
    .maybeSingle();

  const addr = (fulfillment.shipping_address && Object.keys(fulfillment.shipping_address).length
    ? fulfillment.shipping_address
    : (order?.shipping_address as Record<string, any>)) || {};
  if (!addr || !Object.keys(addr).length) {
    return { created: false, job_id: null, reason: "No delivery address on the order" };
  }

  const hub = await getHub(db);
  const dropText = formatAddress(addr);
  const drop = addr.lat && addr.lng
    ? { lat: Number(addr.lat), lng: Number(addr.lng) }
    : await geocode(dropText);

  const pickupAddress = {
    label: hub.label,
    street: hub.street,
    city: hub.city,
    province: hub.province,
    postal_code: hub.postal_code,
    country: hub.country,
    lat: hub.lat,
    lng: hub.lng,
    formatted: formatAddress(hub),
  };

  const deliveryAddress = {
    name: addr.name || addr.full_name || null,
    phone: addr.phone || null,
    street: addr.street || addr.address_line1 || "",
    suburb: addr.suburb || null,
    city: addr.city || "",
    province: addr.province || addr.state || null,
    postal_code: addr.postal_code || addr.zip || null,
    country: addr.country || "South Africa",
    lat: drop.lat,
    lng: drop.lng,
    formatted: dropText,
  };

  const distance = haversineKm({ lat: hub.lat, lng: hub.lng }, drop);
  const earnings = distance != null ? Math.round((35 + distance * 6.5) * 100) / 100 : 45;

  const { data: job, error } = await db.from("delivery_jobs").insert({
    order_id: fulfillment.order_id,
    fulfillment_id: fulfillment.id,
    status: "pending",
    pickup_address: pickupAddress,
    delivery_address: deliveryAddress,
    distance_km: distance,
    earnings,
    estimated_delivery_time: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    notes: [
      "Imported parcel — collect from the 1145 hub.",
      fulfillment.tracking_number ? `Supplier tracking ${fulfillment.carrier || ""} ${fulfillment.tracking_number}`.trim() : null,
    ].filter(Boolean).join(" "),
  }).select("id").single();

  if (error) {
    // Unique index race — another invocation created it first.
    const { data: raced } = await db.from("delivery_jobs").select("id").eq("order_id", fulfillment.order_id).maybeSingle();
    return { created: false, job_id: raced?.id ?? null, reason: error.message };
  }

  return { created: true, job_id: job.id };
}
