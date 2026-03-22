/// <reference types="@types/google.maps" />
import React, { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

const GOOGLE_MAPS_API_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() ||
  "AIzaSyDdvMPREt7NEPYNtDhU0qowu4hidtrDJwo";
const GOOGLE_MAPS_SCRIPT_ID = "google-maps-js";

let googleMapsPromise: Promise<void> | null = null;
let librariesImported = false;

declare global {
  interface Window {
    google?: typeof google;
    __gmapsResolve?: () => void;
  }
}

const waitForGoogleMaps = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.importLibrary) {
      resolve();
      return;
    }
    let attempts = 0;
    const maxAttempts = 100; // 10 seconds
    const check = () => {
      if (window.google?.maps?.importLibrary) {
        resolve();
      } else if (++attempts > maxAttempts) {
        reject(new Error("Google Maps failed to load"));
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
};

export function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only be loaded in the browser"));
  }

  if (window.google?.maps?.importLibrary && librariesImported) return Promise.resolve();
  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(new Error("Missing Google Maps API key"));
  }
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = (async () => {
    // Inject the script if not already present
    if (!document.getElementById(GOOGLE_MAPS_SCRIPT_ID)) {
      // Remove any existing Google Maps scripts to prevent conflicts
      document
        .querySelectorAll(`script[src*="maps.googleapis.com"]`)
        .forEach((s) => s.remove());

      const script = document.createElement("script");
      script.id = GOOGLE_MAPS_SCRIPT_ID;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geometry,marker&loading=async&callback=__gmapsInit`;
      script.async = true;
      script.defer = true;

      // Create a global callback
      (window as any).__gmapsInit = () => {
        // Script loaded
      };

      document.head.appendChild(script);
    }

    // Wait for importLibrary to become available
    await waitForGoogleMaps();

    // Import required libraries
    const libs = ["maps", "places", "geometry", "marker"] as const;
    for (const lib of libs) {
      try {
        await window.google!.maps.importLibrary(lib);
      } catch (e) {
        console.warn(`Failed to import ${lib} library:`, e);
        if (lib !== "geometry") throw e; // geometry is optional
      }
    }

    // Try routes but don't fail if unavailable
    try {
      await window.google!.maps.importLibrary("routes");
    } catch {
      // routes library is optional
    }

    librariesImported = true;
  })().catch((err) => {
    googleMapsPromise = null;
    librariesImported = false;
    throw err;
  });

  return googleMapsPromise;
}

interface GoogleMapProps {
  className?: string;
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: Array<{
    position: { lat: number; lng: number };
    title?: string;
    icon?: string;
    label?: string;
  }>;
  route?: {
    origin: { lat: number; lng: number };
    destination: { lat: number; lng: number };
  };
  driverLocation?: { lat: number; lng: number };
  onMapReady?: (map: google.maps.Map) => void;
}

const GoogleMap: React.FC<GoogleMapProps> = ({
  className = "w-full h-64 rounded-xl overflow-hidden",
  center = { lat: -26.2041, lng: 28.0473 }, // Johannesburg default
  zoom = 13,
  markers = [],
  route,
  driverLocation,
  onMapReady,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const driverMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

  const [loaded, setLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    loadGoogleMaps()
      .then(() => {
        if (!isMounted) return;
        setLoaded(true);
        setMapError(null);
      })
      .catch((error) => {
        console.error("Google Maps loading error:", error);
        if (!isMounted) return;
        setMapError(error instanceof Error ? error.message : "Map preview unavailable");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded || !mapRef.current || mapInstanceRef.current) return;

    try {
      const map = new google.maps.Map(mapRef.current, {
        center,
        zoom,
        mapId: "ride_map_id",
        disableDefaultUI: true,
        zoomControl: true,
      });

      mapInstanceRef.current = map;
      onMapReady?.(map);
    } catch (error) {
      console.error("Google Maps initialization error:", error);
      setMapError("Map preview unavailable");
    }
  }, [loaded, center, zoom, onMapReady]);

  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    markersRef.current.forEach((marker) => (marker.map = null));
    markersRef.current = [];

    markers.forEach((markerData) => {
      const content = document.createElement("div");
      if (markerData.label) {
        content.textContent = markerData.label;
        content.style.cssText = "background:#4361EE;color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);";
      }

      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: markerData.position,
        map: mapInstanceRef.current!,
        title: markerData.title,
        ...(markerData.label ? { content } : {}),
      });
      markersRef.current.push(marker);
    });

    if (markers.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      markers.forEach((markerData) => bounds.extend(markerData.position));
      mapInstanceRef.current.fitBounds(bounds, 60);
    } else if (markers.length === 1) {
      mapInstanceRef.current.setCenter(markers[0].position);
    }
  }, [markers, loaded]);

  // Draw route
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (!route) {
      directionsRendererRef.current?.setMap(null);
      directionsRendererRef.current = null;
      return;
    }

    if (!directionsRendererRef.current) {
      directionsRendererRef.current = new google.maps.DirectionsRenderer({
        suppressMarkers: false,
        polylineOptions: { strokeColor: "#4361EE", strokeWeight: 5 },
      });
      directionsRendererRef.current.setMap(mapInstanceRef.current);
    }

    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
      {
        origin: route.origin,
        destination: route.destination,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === "OK" && result) {
          directionsRendererRef.current?.setDirections(result);
        }
      }
    );
  }, [route, loaded]);

  // Driver location marker
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (!driverLocation) {
      if (driverMarkerRef.current) driverMarkerRef.current.map = null;
      driverMarkerRef.current = null;
      return;
    }

    if (!driverMarkerRef.current) {
      const el = document.createElement("div");
      el.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="#4361EE" stroke="#fff" stroke-width="2"><path d="M12 2L4 20h16L12 2z"/></svg>`;
      el.style.cssText = "filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));";

      driverMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map: mapInstanceRef.current,
        title: "Driver",
        content: el,
      });
    }

    driverMarkerRef.current.position = driverLocation;
    mapInstanceRef.current.panTo(driverLocation);
  }, [driverLocation, loaded]);

  useEffect(() => {
    return () => {
      markersRef.current.forEach((marker) => (marker.map = null));
      directionsRendererRef.current?.setMap(null);
      if (driverMarkerRef.current) driverMarkerRef.current.map = null;
      mapInstanceRef.current = null;
    };
  }, []);

  if (!loaded && !mapError) {
    return (
      <div className={`${className} bg-muted flex items-center justify-center`}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (mapError) {
    return (
      <div className={`${className} bg-muted flex flex-col items-center justify-center gap-2`}>
        <MapPin className="h-8 w-8 text-muted-foreground" />
        <p className="text-xs text-muted-foreground text-center px-4">
          Map preview unavailable. You can still continue without map view.
        </p>
      </div>
    );
  }

  return <div ref={mapRef} className={className} />;
};

export default GoogleMap;
