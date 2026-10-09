// Checks a customer's delivery address against an eatery's delivery areas, on the server.
//
// The street address is located on the map (OpenStreetMap's Nominatim, the same service
// the app's address search uses) and compared with where the eatery's areas are. The
// result is saved in food_address_checks; place_food_order() only accepts an order to an
// area-limited eatery when it comes with a recent check for that same address.
//
// Outcomes returned to the app:
//   ok, verified     the address is on the map, inside one of the areas
//   ok, unverified   the address is not on the map; the customer chose a listed area
//   outside          the address is on the map, outside every area  (order refused)
//   choose_area      the address is not on the map; ask the customer to choose an area
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { type LocatedAddress, matchZone, nearestZone, normaliseName, zonesFor } from "../_shared/deliveryArea.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
// Nominatim asks every application to identify itself.
const USER_AGENT = "1145.io food delivery address check (support@1145.io)";
const MAX_CHECKS_PER_10_MIN = 15;
// Address fields that name the place an address is in, most specific first.
const PLACE_FIELDS = ["suburb", "neighbourhood", "quarter", "residential", "hamlet", "city_district", "borough", "village", "town", "city", "municipality"];

type NominatimResult = { lat: string; lon: string; display_name: string; address?: Record<string, string> };

/** A result only counts if it found the street itself, not just the suburb or city around it. */
const isStreetLevel = (r: NominatimResult) => !!(r.address && (r.address.road || r.address.house_number || r.address.pedestrian));

async function search(params: Record<string, string>): Promise<NominatimResult[]> {
  const query = new URLSearchParams({ format: "jsonv2", addressdetails: "1", limit: "3", ...params });
  const response = await fetch(`${NOMINATIM}?${query}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json", "Accept-Language": "en" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Address lookup returned ${response.status}`);
  return await response.json();
}

/** Locates a street address. Returns null when the map does not know the street. */
async function locate(street: string, city: string, postalCode: string): Promise<LocatedAddress | null> {
  const attempts: Record<string, string>[] = [
    { street, city, ...(postalCode ? { postalcode: postalCode } : {}), country: "South Africa" },
    { q: [street, city].filter(Boolean).join(", "), countrycodes: "za" },
  ];
  for (const [index, params] of attempts.entries()) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, 1100)); // at most one request a second
    const hit = (await search(params)).find(isStreetLevel);
    if (hit) {
      const lat = Number(hit.lat), lng = Number(hit.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      return {
        lat, lng,
        placeNames: PLACE_FIELDS.map((field) => hit.address?.[field]).filter((name): name is string => !!name),
        displayName: hit.display_name,
      };
    }
  }
  return null;
}

const clean = (value: unknown, max: number) => String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: auth } = await admin.auth.getUser(token);
    if (!auth?.user) return respond({ ok: false, reason: "unauthorized", message: "Sign in to continue." }, 401);
    const userId = auth.user.id;

    const body = await req.json().catch(() => ({}));
    const eateryId = clean(body.eateryId, 40);
    const street = clean(body.street, 200);
    const city = clean(body.city, 80);
    const postalCode = clean(body.postalCode, 12);
    const chosenArea = clean(body.area, 60);
    if (!eateryId || street.length < 3 || city.length < 2) {
      return respond({ ok: false, reason: "invalid", message: "Enter your street address and city." }, 400);
    }

    const { data: eatery } = await admin
      .from("eateries").select("id, name, status, delivery_areas, delivery_zones").eq("id", eateryId).maybeSingle();
    if (!eatery || eatery.status !== "approved") {
      return respond({ ok: false, reason: "invalid", message: "This eatery is not available." }, 404);
    }
    const areaNames: string[] = eatery.delivery_areas ?? [];
    if (areaNames.length === 0) return respond({ ok: true, required: false });

    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("food_address_checks").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since);
    if ((count ?? 0) >= MAX_CHECKS_PER_10_MIN) {
      return respond({ ok: false, reason: "rate_limited", message: "Too many address checks. Please wait a few minutes and try again." }, 429);
    }

    const zones = zonesFor(areaNames, eatery.delivery_zones);
    const record = (fields: Record<string, unknown>) =>
      admin.from("food_address_checks")
        .insert({ user_id: userId, eatery_id: eatery.id, street, city, postal_code: postalCode || null, ...fields })
        .select("id").single();

    let located: LocatedAddress | null = null;
    try {
      located = await locate(street, city, postalCode);
    } catch (error) {
      // The map service being down must not stop people ordering: treat it as "not found".
      console.error("Address lookup failed:", error);
    }

    if (located) {
      const zone = matchZone(zones, located);
      const position = { latitude: located.lat, longitude: located.lng, matched_place: located.displayName.slice(0, 300) };
      if (zone) {
        const { data, error } = await record({ ...position, area: zone.name, outcome: "verified" });
        if (error) throw error;
        return respond({ ok: true, required: true, verified: true, checkId: data.id, area: zone.name });
      }
      await record({ ...position, outcome: "outside" });
      const nearest = nearestZone(zones, located);
      const foundIn = located.placeNames[0];
      return respond({
        ok: false,
        reason: "outside",
        message: `${eatery.name} doesn't deliver to that address${foundIn ? ` (it's in ${foundIn})` : ""}.`
          + (nearest ? ` The nearest area it delivers to is ${nearest.zone.name}, about ${nearest.km < 10 ? nearest.km.toFixed(1) : Math.round(nearest.km)} km away.` : ""),
      });
    }

    // Not on the map. Many real addresses aren't, so let the customer choose a listed
    // area; the order is marked unverified and the eatery is told to confirm it.
    const listed = areaNames.find((name) => normaliseName(name) === normaliseName(chosenArea));
    if (listed) {
      const { data, error } = await record({ area: listed, outcome: "unverified" });
      if (error) throw error;
      return respond({ ok: true, required: true, verified: false, checkId: data.id, area: listed });
    }
    await record({ outcome: "not_found" });
    return respond({
      ok: false,
      reason: "choose_area",
      message: "We couldn't find that address on the map. Check the street name and number, or choose your area below.",
      areas: areaNames,
    });
  } catch (error) {
    console.error("food-check-address failed:", error);
    return respond({ ok: false, reason: "error", message: "We couldn't check your address just now. Please try again." }, 500);
  }
});
