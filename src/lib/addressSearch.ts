// Address search for ride and delivery forms. OpenStreetMap (Nominatim),
// limited to South Africa and centred on the rider: places within
// LOCAL_RADIUS_KM come first, and the whole country is searched only when
// nothing local matches. Each result carries its town, province and distance,
// so a same-named street in another province can't pass for a local one.

export interface LatLng {
  lat: number;
  lng: number;
}

export interface AddressResult extends LatLng {
  id: string;
  /** Full address, used as the field's value. */
  address: string;
  /** First part of the address, e.g. "12 Main Road, Riverside". */
  title: string;
  /** Town and province, e.g. "Mbombela, Mpumalanga". */
  area: string;
  /** Kilometres from the search centre, when one was given. */
  distanceKm: number | null;
}

export const LOCAL_RADIUS_KM = 50;

export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

interface NominatimPlace {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
}

function toResult(place: NominatimPlace, near?: LatLng | null): AddressResult | null {
  const lat = Number(place.lat);
  const lng = Number(place.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const a = place.address ?? {};
  const town = a.city || a.town || a.village || a.municipality || a.county || "";
  const area = [town, a.state].filter(Boolean).join(", ");
  const title = place.display_name.split(", ").slice(0, 2).join(", ");
  return {
    id: String(place.place_id),
    address: place.display_name,
    title,
    area,
    lat,
    lng,
    distanceKm: near ? distanceKm(near, { lat, lng }) : null,
  };
}

async function nominatim(query: string, limit: number, near: LatLng | null | undefined, local: boolean, signal?: AbortSignal) {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    limit: String(limit),
    countrycodes: "za",
  });
  if (near && local) {
    // ~LOCAL_RADIUS_KM box around the centre; bounded=1 keeps results inside it.
    const dLat = LOCAL_RADIUS_KM / 111;
    const dLng = LOCAL_RADIUS_KM / (111 * Math.cos((near.lat * Math.PI) / 180));
    params.set("viewbox", [near.lng - dLng, near.lat + dLat, near.lng + dLng, near.lat - dLat].join(","));
    params.set("bounded", "1");
  }
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Address search failed");
  return ((await response.json()) as NominatimPlace[]).map((p) => toResult(p, near)).filter((r): r is AddressResult => !!r);
}

/** Nearest matches first. Falls back to a country-wide search when nothing is close by. */
export async function searchAddresses(
  query: string,
  near?: LatLng | null,
  options: { limit?: number; signal?: AbortSignal } = {},
): Promise<AddressResult[]> {
  const q = query.trim();
  if (!q) return [];
  const limit = options.limit ?? 5;
  let results = near ? await nominatim(q, limit, near, true, options.signal) : [];
  if (results.length === 0) results = await nominatim(q, near ? 10 : limit, near, false, options.signal);
  if (near) results.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  return results.slice(0, limit);
}

export const formatDistance = (km: number | null) =>
  km === null ? "" : km < 1 ? `${Math.round(km * 1000)} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
