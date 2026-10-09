// Deciding whether a located address falls inside one of an eatery's delivery areas.
// Pure functions (no network, no database) so they can be tested on their own.

export interface DeliveryZone {
  name: string;
  lat?: number | null;
  lng?: number | null;
  south?: number | null;
  north?: number | null;
  west?: number | null;
  east?: number | null;
}

/** What the map lookup found for a street address. */
export interface LocatedAddress {
  lat: number;
  lng: number;
  /** Place names from the lookup: suburb, neighbourhood, town, city… */
  placeNames: string[];
  displayName: string;
}

/** Slack around an area's box (about 500 m), since suburb boxes are approximate. */
const PADDING_DEGREES = 0.005;

/** "Orlando-West " → "orlando west", accents removed, so names compare fairly. */
export const normaliseName = (text: string) =>
  text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

const hasBox = (z: DeliveryZone) =>
  [z.south, z.north, z.west, z.east].every((n) => typeof n === "number" && Number.isFinite(n));

const insideBox = (z: DeliveryZone, lat: number, lng: number) =>
  hasBox(z)
  && lat >= (z.south as number) - PADDING_DEGREES && lat <= (z.north as number) + PADDING_DEGREES
  && lng >= (z.west as number) - PADDING_DEGREES && lng <= (z.east as number) + PADDING_DEGREES;

const boxArea = (z: DeliveryZone) => ((z.north as number) - (z.south as number)) * ((z.east as number) - (z.west as number));

/** Rough distance in km; fine at city scale. */
export const distanceKm = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const dLat = (bLat - aLat) * 111.32;
  const dLng = (bLng - aLng) * 111.32 * Math.cos(((aLat + bLat) / 2) * Math.PI / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
};

/**
 * The delivery area an address is in, or null if it is in none.
 * An address is in an area when the map names that area for it, or when its
 * position falls inside the area's box. Of several, the smallest (most specific) wins.
 */
export function matchZone(zones: DeliveryZone[], address: LocatedAddress): DeliveryZone | null {
  const names = new Set(address.placeNames.map(normaliseName).filter(Boolean));
  const byName = zones.find((z) => names.has(normaliseName(z.name)));
  if (byName) return byName;
  const containing = zones.filter((z) => insideBox(z, address.lat, address.lng));
  if (!containing.length) return null;
  return containing.sort((a, b) => boxArea(a) - boxArea(b))[0];
}

/** The nearest area with a known position, for a helpful "you're X km from …" message. */
export function nearestZone(zones: DeliveryZone[], address: LocatedAddress): { zone: DeliveryZone; km: number } | null {
  let best: { zone: DeliveryZone; km: number } | null = null;
  for (const zone of zones) {
    if (typeof zone.lat !== "number" || typeof zone.lng !== "number") continue;
    const km = distanceKm(address.lat, address.lng, zone.lat, zone.lng);
    if (!best || km < best.km) best = { zone, km };
  }
  return best;
}

/**
 * Pairs each listed area name with its saved position. Areas the owner typed
 * without picking from the map have no position and can only match by name.
 */
export function zonesFor(areaNames: string[], savedZones: unknown): DeliveryZone[] {
  const saved = Array.isArray(savedZones) ? (savedZones as DeliveryZone[]) : [];
  return areaNames.map((name) => {
    const zone = saved.find((z) => z && typeof z.name === "string" && normaliseName(z.name) === normaliseName(name));
    return zone ? { ...zone, name } : { name };
  });
}
