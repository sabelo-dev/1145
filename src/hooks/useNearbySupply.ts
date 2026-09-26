import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LatLng = { lat: number; lng: number };

export interface NearbySupply {
  available: number;
  nearestKm: number | null;
  /** Approximate minutes for the nearest available driver to arrive. */
  etaMin: number | null;
  /** Anonymised car positions (snapped to a ~500 m grid by the server). */
  cars: LatLng[];
  asOf: Date | null;
}

/** Johannesburg CBD — used until the user shares their location. */
export const DEFAULT_CENTER: LatLng = { lat: -26.2041, lng: 28.0473 };
const LOCATION_KEY = "1145:last-location";
const POLL_MS = 15_000;
const CITY_SPEED_KMH = 25;

/** Rough city ETA: drive time at ~25 km/h plus a minute to get moving. */
export const etaFromKm = (km: number | null) =>
  km == null ? null : Math.max(2, Math.round((km / CITY_SPEED_KMH) * 60 + 1));

/**
 * Live, anonymised driver supply around a point. Polls the
 * get_nearby_supply RPC while the tab is visible (no polling in background).
 */
export function useNearbySupply(center: LatLng, radiusKm = 8) {
  const [data, setData] = useState<NearbySupply | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      // RPC is newer than the generated types, hence the cast.
      const { data: res, error: rpcError } = await (supabase.rpc as any)("get_nearby_supply", {
        p_lat: center.lat,
        p_lng: center.lng,
        p_radius_km: radiusKm,
      });
      if (rpcError) throw rpcError;
      const nearestKm = res?.nearest_km == null ? null : Number(res.nearest_km);
      setData({
        available: Number(res?.available ?? 0),
        nearestKm,
        etaMin: etaFromKm(nearestKm),
        cars: (res?.cars ?? []).map((c: any) => ({ lat: Number(c.lat), lng: Number(c.lng) })),
        asOf: res?.as_of ? new Date(res.as_of) : new Date(),
      });
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Live data unavailable");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [center.lat, center.lng, radiusKm]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      void refresh();
      timer = setInterval(() => void refresh(), POLL_MS);
    };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    const onVisibility = () => (document.visibilityState === "visible" ? start() : stop());

    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [refresh]);

  return { data, error, loading, refresh };
}

/** The user's location, only requested when they ask for it. */
export function useUserLocation() {
  const [location, setLocation] = useState<LatLng | null>(() => {
    try {
      const saved = sessionStorage.getItem(LOCATION_KEY);
      return saved ? (JSON.parse(saved) as LatLng) : null;
    } catch {
      return null;
    }
  });
  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState(false);

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) { setDenied(true); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(next);
        setDenied(false);
        setLocating(false);
        try { sessionStorage.setItem(LOCATION_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
      },
      () => { setDenied(true); setLocating(false); },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }, []);

  return { location, locating, denied, locate };
}
