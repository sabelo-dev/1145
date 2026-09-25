/// <reference types="google.maps" />
import React, { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/components/maps/GoogleMap";
import type { LatLng } from "@/hooks/useNearbySupply";

interface LiveRideMapProps {
  center: LatLng;
  /** Anonymised nearby cars. */
  cars: LatLng[];
  /** The viewer's own position, if they shared it. */
  userLocation?: LatLng | null;
  /** An active trip: pickup, drop-off and (live) driver position. */
  trip?: { pickup?: LatLng | null; dropoff?: LatLng | null; driver?: LatLng | null } | null;
  /** Rendered when Google Maps can't load (e.g. no key) so the hero never breaks. */
  fallback: React.ReactNode;
}

const el = (html: string) => {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.firstElementChild as HTMLElement;
};

const carIcon = (live = false) =>
  el(`<div style="width:26px;height:26px;border-radius:9px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.35);${live ? "outline:3px solid #00D4FF;" : ""}">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0B1020" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
  </div>`);

const userDot = () =>
  el(`<div style="position:relative;width:18px;height:18px">
    <span style="position:absolute;inset:-10px;border-radius:9999px;background:rgba(0,212,255,.25);animation:ping 2s cubic-bezier(0,0,.2,1) infinite"></span>
    <span style="position:absolute;inset:0;border-radius:9999px;background:#00D4FF;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4)"></span>
  </div>`);

const pin = (color: string, square = false) =>
  el(`<div style="width:16px;height:16px;${square ? "border-radius:4px" : "border-radius:9999px"};background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>`);

/** Live map for the home hero. Falls back to the illustration if Maps is unavailable. */
const LiveRideMap: React.FC<LiveRideMapProps> = ({ center, cars, userLocation, trip, fallback }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const layerRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let alive = true;
    const onAuthFail = () => alive && setStatus("failed");
    window.addEventListener("google-maps-auth-failure", onAuthFail);
    loadGoogleMaps()
      .then(() => {
        if (!alive || !containerRef.current || mapRef.current) return;
        mapRef.current = new google.maps.Map(containerRef.current, {
          center,
          zoom: 13,
          mapId: "DEMO_MAP_ID",
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: "cooperative", // never hijack page scrolling
          colorScheme: "DARK" as unknown as google.maps.ColorScheme,
        });
        setStatus("ready");
      })
      .catch(() => alive && setStatus("failed"));
    return () => {
      alive = false;
      window.removeEventListener("google-maps-auth-failure", onAuthFail);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw markers whenever live data changes.
  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map) return;
    layerRef.current.forEach((m) => (m.map = null));
    layerRef.current = [];
    const add = (position: LatLng, content: HTMLElement, title: string, zIndex = 1) =>
      layerRef.current.push(new google.maps.marker.AdvancedMarkerElement({ map, position, content, title, zIndex }));

    if (trip?.pickup || trip?.dropoff || trip?.driver) {
      const bounds = new google.maps.LatLngBounds();
      if (trip.pickup) { add(trip.pickup, pin("#00D4FF"), "Pickup", 2); bounds.extend(trip.pickup); }
      if (trip.dropoff) { add(trip.dropoff, pin("#D4AF37", true), "Drop-off", 2); bounds.extend(trip.dropoff); }
      if (trip.driver) { add(trip.driver, carIcon(true), "Your driver", 3); bounds.extend(trip.driver); }
      map.fitBounds(bounds, 64);
      return;
    }

    cars.forEach((c) => add(c, carIcon(), "Available driver"));
    if (userLocation) add(userLocation, userDot(), "You", 3);
    map.panTo(userLocation ?? center);
  }, [status, cars, userLocation, trip, center]);

  return (
    <div className="absolute inset-0">
      {status !== "ready" && <div className="absolute inset-0">{fallback}</div>}
      <div ref={containerRef} className={status === "ready" ? "absolute inset-0" : "hidden"} aria-label="Live map of nearby drivers" />
    </div>
  );
};

export default LiveRideMap;
