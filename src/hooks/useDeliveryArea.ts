import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { haversineDistance } from "@/services/dispatch/geoUtils";
import { track } from "@/lib/analytics";

/**
 * The visitor's delivery area, chosen from a list or (with permission) from
 * their location. Shared by every component through one small store and kept
 * in localStorage, so the choice survives visits.
 */
export interface DeliveryArea {
  id: string;
  label: string;
  province: string;
  lat: number;
  lng: number;
}

export const DELIVERY_AREAS: DeliveryArea[] = [
  { id: "jhb", label: "Johannesburg", province: "Gauteng", lat: -26.2041, lng: 28.0473 },
  { id: "pta", label: "Pretoria", province: "Gauteng", lat: -25.7479, lng: 28.2293 },
  { id: "ekurhuleni", label: "Ekurhuleni", province: "Gauteng", lat: -26.1496, lng: 28.3226 },
  { id: "cpt", label: "Cape Town", province: "Western Cape", lat: -33.9249, lng: 18.4241 },
  { id: "dbn", label: "Durban", province: "KwaZulu-Natal", lat: -29.8587, lng: 31.0218 },
  { id: "pmb", label: "Pietermaritzburg", province: "KwaZulu-Natal", lat: -29.6006, lng: 30.3794 },
  { id: "gqeberha", label: "Gqeberha", province: "Eastern Cape", lat: -33.9608, lng: 25.6022 },
  { id: "el", label: "East London", province: "Eastern Cape", lat: -33.0153, lng: 27.9116 },
  { id: "blm", label: "Bloemfontein", province: "Free State", lat: -29.0852, lng: 26.1596 },
  { id: "polokwane", label: "Polokwane", province: "Limpopo", lat: -23.9045, lng: 29.4689 },
  { id: "mbombela", label: "Mbombela", province: "Mpumalanga", lat: -25.4753, lng: 30.9694 },
  { id: "rustenburg", label: "Rustenburg", province: "North West", lat: -25.6676, lng: 27.2421 },
  { id: "kimberley", label: "Kimberley", province: "Northern Cape", lat: -28.7282, lng: 24.7499 },
];

const AREA_KEY = "1145:delivery-area";
const listeners = new Set<() => void>();

function read(): DeliveryArea | null {
  try {
    const raw = localStorage.getItem(AREA_KEY);
    return raw ? (JSON.parse(raw) as DeliveryArea) : null;
  } catch {
    return null;
  }
}

let current: DeliveryArea | null = typeof window === "undefined" ? null : read();

function write(area: DeliveryArea | null) {
  current = area;
  try {
    if (area) localStorage.setItem(AREA_KEY, JSON.stringify(area));
    else localStorage.removeItem(AREA_KEY);
  } catch { /* storage unavailable: the choice lasts for this page view */ }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };

/** Nearest listed area to a point (the list covers each province's main centre). */
export const nearestArea = (lat: number, lng: number): DeliveryArea =>
  DELIVERY_AREAS.reduce((best, a) =>
    haversineDistance({ lat, lng }, a) < haversineDistance({ lat, lng }, best) ? a : best);

export function useDeliveryArea() {
  const area = useSyncExternalStore(subscribe, () => current, () => null);
  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState(false);

  const setArea = useCallback((next: DeliveryArea | null, source: "list" | "location" = "list") => {
    write(next);
    if (next) track("area_selected", { area: next.label, province: next.province, source });
  }, []);

  /** Asks for location only when the visitor taps the button. */
  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) { setDenied(true); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const near = nearestArea(pos.coords.latitude, pos.coords.longitude);
        // Keep the visitor's own point for ride checks; the label names the nearest centre.
        setArea({ ...near, lat: pos.coords.latitude, lng: pos.coords.longitude }, "location");
        setDenied(false);
        setLocating(false);
      },
      () => { setDenied(true); setLocating(false); },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 },
    );
  }, [setArea]);

  return { area, setArea, locate, locating, denied };
}

export type RideAvailability = "unknown" | "checking" | "live" | "unavailable";

/**
 * Whether rides can honestly be offered in an area: only "live" when drivers
 * are online within 20 km right now. Never promises a ride otherwise.
 */
export function useRideAvailability(area: DeliveryArea | null) {
  const [state, setState] = useState<{ status: RideAvailability; drivers: number }>({ status: "unknown", drivers: 0 });

  useEffect(() => {
    if (!area) { setState({ status: "unknown", drivers: 0 }); return; }
    let alive = true;
    setState({ status: "checking", drivers: 0 });
    (async () => {
      // RPC is newer than the generated types, hence the cast.
      const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args: Record<string, unknown>) =>
        Promise<{ data: { available?: number } | null; error: unknown }>;
      const { data, error } = await rpc("get_nearby_supply", {
        p_lat: area.lat, p_lng: area.lng, p_radius_km: 20,
      });
      if (!alive) return;
      if (error) { setState({ status: "unknown", drivers: 0 }); return; }
      const drivers = Number(data?.available ?? 0);
      setState({ status: drivers > 0 ? "live" : "unavailable", drivers });
    })().catch(() => alive && setState({ status: "unknown", drivers: 0 }));
    return () => { alive = false; };
  }, [area]);

  return state;
}
