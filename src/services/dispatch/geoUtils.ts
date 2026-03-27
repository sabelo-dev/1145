/**
 * Geographic utility functions for the dispatch engine.
 * Haversine formula, bearing, bounding box calculations.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

function toDeg(rad: number): number {
  return rad * (180 / Math.PI);
}

/** Haversine distance between two points in km */
export function haversineDistance(p1: GeoPoint, p2: GeoPoint): number {
  const dLat = toRad(p2.lat - p1.lat);
  const dLng = toRad(p2.lng - p1.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) *
    Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Estimated travel time in minutes (avg speed factor) */
export function estimateTravelMins(distanceKm: number, avgSpeedKmh: number = 30): number {
  return Math.round((distanceKm / avgSpeedKmh) * 60);
}

/** Bearing from p1 to p2 in degrees */
export function bearing(p1: GeoPoint, p2: GeoPoint): number {
  const dLng = toRad(p2.lng - p1.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(p2.lat));
  const x =
    Math.cos(toRad(p1.lat)) * Math.sin(toRad(p2.lat)) -
    Math.sin(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Get bounding box for a center point and radius (for quick DB filtering) */
export function boundingBox(center: GeoPoint, radiusKm: number): {
  minLat: number; maxLat: number; minLng: number; maxLng: number;
} {
  const latDelta = toDeg(radiusKm / EARTH_RADIUS_KM);
  const lngDelta = toDeg(radiusKm / (EARTH_RADIUS_KM * Math.cos(toRad(center.lat))));
  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - lngDelta,
    maxLng: center.lng + lngDelta,
  };
}

/** Check if a point is within a circle */
export function isWithinRadius(point: GeoPoint, center: GeoPoint, radiusKm: number): boolean {
  return haversineDistance(point, center) <= radiusKm;
}

/** Sort points by distance from a reference point */
export function sortByDistance<T extends { lat: number; lng: number }>(
  points: T[],
  from: GeoPoint
): (T & { distance_km: number })[] {
  return points
    .map((p) => ({
      ...p,
      distance_km: Math.round(haversineDistance(from, { lat: p.lat, lng: p.lng }) * 10) / 10,
    }))
    .sort((a, b) => a.distance_km - b.distance_km);
}
