import { Capacitor } from "@capacitor/core";

export interface NavTarget {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
}

const hasCoords = (t: NavTarget): t is { lat: number; lng: number; address?: string } =>
  typeof t.lat === "number" &&
  typeof t.lng === "number" &&
  Number.isFinite(t.lat) &&
  Number.isFinite(t.lng);

/** Normalise a jsonb address (object or string) to a single line. */
export function formatAddress(address: unknown): string {
  if (!address) return "";
  if (typeof address === "string") return address;
  const a = address as Record<string, unknown>;
  return [a.street, a.suburb, a.city, a.province, a.postal_code, a.country || "South Africa"]
    .filter(Boolean)
    .join(", ");
}

/** Pull coordinates out of a jsonb address if the record carries them. */
export function extractCoords(address: unknown): { lat: number; lng: number } | null {
  if (!address || typeof address !== "object") return null;
  const a = address as Record<string, any>;
  const lat = Number(a.lat ?? a.latitude);
  const lng = Number(a.lng ?? a.lon ?? a.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
    return { lat, lng };
  }
  return null;
}

/**
 * Geocode an address (string or jsonb object) to coordinates using the Maps JS
 * Geocoder. Returns null when Maps is unavailable or nothing matches, so
 * callers can fall back to address-string navigation.
 */
export async function geocodeAddress(
  address: unknown
): Promise<{ lat: number; lng: number } | null> {
  const existing = extractCoords(address);
  if (existing) return existing;

  const line = formatAddress(address);
  if (!line) return null;

  try {
    const { loadGoogleMaps } = await import("@/components/maps/GoogleMap");
    await loadGoogleMaps();
    const geocoder = new google.maps.Geocoder();
    const { results } = await geocoder.geocode({
      address: line,
      componentRestrictions: { country: "ZA" },
    });
    const loc = results?.[0]?.geometry?.location;
    if (!loc) return null;
    return { lat: loc.lat(), lng: loc.lng() };
  } catch {
    return null;
  }
}

/**
 * Attach lat/lng to a jsonb address so drivers get pin-precise routing later.
 * Falls back to the original value when geocoding is unavailable.
 */
export async function withCoords(address: unknown): Promise<Record<string, any>> {
  const base: Record<string, any> =
    typeof address === "string"
      ? { street: address }
      : { ...((address as Record<string, any>) || {}) };
  const coords = await geocodeAddress(address);
  if (!coords) return base;
  return { ...base, lat: coords.lat, lng: coords.lng };
}

/**
 * Turn-by-turn directions URL. Coordinates are always preferred so the driver
 * is routed to the exact drop pin instead of a fuzzy address match.
 */
export function buildDirectionsUrl(target: NavTarget, origin?: NavTarget): string {
  const destination = hasCoords(target)
    ? `${target.lat},${target.lng}`
    : (target.address || "").trim();
  if (!destination) return "";

  const params = new URLSearchParams({
    api: "1",
    destination,
    travelmode: "driving",
    dir_action: "navigate",
  });
  if (origin && hasCoords(origin)) params.set("origin", `${origin.lat},${origin.lng}`);

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Map pin (no routing) for a location preview. */
export function buildPlaceUrl(target: NavTarget): string {
  const query = hasCoords(target) ? `${target.lat},${target.lng}` : (target.address || "").trim();
  if (!query) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Open native navigation where available, otherwise a new browser tab. */
export function openDirections(target: NavTarget, origin?: NavTarget): void {
  const url = buildDirectionsUrl(target, origin);
  if (!url) return;

  if (Capacitor.isNativePlatform() && hasCoords(target)) {
    const geo =
      Capacitor.getPlatform() === "ios"
        ? `maps://?daddr=${target.lat},${target.lng}&dirflg=d`
        : `geo:${target.lat},${target.lng}?q=${target.lat},${target.lng}`;
    window.open(geo, "_system");
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}
