/// <reference types="@types/google.maps" />
import React, { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

const GOOGLE_MAPS_API_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() ||
  "AIzaSyDdvMPREt7NEPYNtDhU0qowu4hidtrDJwo";
const GOOGLE_MAPS_SCRIPT_ID = "google-maps-js";
const GOOGLE_MAPS_LIBRARIES = "places,geometry";

let googleMapsPromise: Promise<void> | null = null;

declare global {
  interface Window {
    google?: typeof google;
  }
}

export function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only be loaded in the browser"));
  }

  if (window.google?.maps) return Promise.resolve();
  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(new Error("Missing Google Maps API key"));
  }
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    let settled = false;

    const succeed = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      googleMapsPromise = null;
      reject(new Error(message));
    };

    const importLibraries = async () => {
      try {
        if (!window.google?.maps?.importLibrary) {
          fail("Google Maps importLibrary API is unavailable");
          return;
        }

        // Required by current app features
        await google.maps.importLibrary("maps");
        await google.maps.importLibrary("places");
        await google.maps.importLibrary("geometry");

        // Optional: routes is not required for current RideRequest flow
        try {
          await google.maps.importLibrary("routes");
        } catch (routesError) {
          console.warn("Google Maps routes library unavailable:", routesError);
        }

        succeed();
      } catch (error) {
        const details = error instanceof Error ? `: ${error.message}` : "";
        fail(`Failed to import Google Maps libraries${details}`);
      }
    };

    const validateGoogleMapsLoaded = () => {
      if (window.google?.maps) {
        importLibraries();
      } else {
        fail("Google Maps loaded without the maps object");
      }
    };

    const existingScript = document.getElementById(
      GOOGLE_MAPS_SCRIPT_ID
    ) as HTMLScriptElement | null;

    if (existingScript) {
      if (existingScript.dataset.loaded === "true") {
        validateGoogleMapsLoaded();
        return;
      }

      existingScript.addEventListener("load", validateGoogleMapsLoaded, { once: true });
      existingScript.addEventListener("error", () => fail("Failed to load Google Maps script"), {
        once: true,
      });

      window.setTimeout(() => {
        if (!window.google?.maps) {
          fail("Google Maps loading timed out");
        }
      }, 12000);

      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      GOOGLE_MAPS_API_KEY
    )}&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      validateGoogleMapsLoaded();
    };
    script.onerror = () => {
      script.dataset.failed = "true";
      script.remove();
      fail("Failed to load Google Maps script");
    };

    document.head.appendChild(script);

    window.setTimeout(() => {
      if (!window.google?.maps) {
        fail("Google Maps loading timed out");
      }
    }, 12000);
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
  const markersRef = useRef<google.maps.Marker[]>([]);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);

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
        disableDefaultUI: true,
        zoomControl: true,
        styles: [
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "simplified" }] },
        ],
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

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    markers.forEach((markerData) => {
      const marker = new google.maps.Marker({
        position: markerData.position,
        map: mapInstanceRef.current!,
        title: markerData.title,
        label: markerData.label,
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
      driverMarkerRef.current?.setMap(null);
      driverMarkerRef.current = null;
      return;
    }

    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new google.maps.Marker({
        map: mapInstanceRef.current,
        title: "Driver",
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: "#4361EE",
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: "#fff",
          rotation: 0,
        },
      });
    }

    driverMarkerRef.current.setPosition(driverLocation);
    mapInstanceRef.current.panTo(driverLocation);
  }, [driverLocation, loaded]);

  useEffect(() => {
    return () => {
      markersRef.current.forEach((marker) => marker.setMap(null));
      directionsRendererRef.current?.setMap(null);
      driverMarkerRef.current?.setMap(null);
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
