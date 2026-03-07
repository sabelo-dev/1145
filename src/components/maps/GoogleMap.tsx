/// <reference types="@types/google.maps" />
import React, { useEffect, useRef, useState, useCallback } from "react";

const GOOGLE_MAPS_API_KEY = "AIzaSyDdvMPREt7NEPYNtDhU0qowu4hidtrDJwo";

let googleMapsPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
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

  useEffect(() => {
    loadGoogleMaps().then(() => setLoaded(true)).catch(console.error);
  }, []);

  useEffect(() => {
    if (!loaded || !mapRef.current || mapInstanceRef.current) return;

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
  }, [loaded]);

  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    markers.forEach((m) => {
      const marker = new google.maps.Marker({
        position: m.position,
        map: mapInstanceRef.current!,
        title: m.title,
        label: m.label,
      });
      markersRef.current.push(marker);
    });

    if (markers.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      markers.forEach((m) => bounds.extend(m.position));
      mapInstanceRef.current.fitBounds(bounds, 60);
    } else if (markers.length === 1) {
      mapInstanceRef.current.setCenter(markers[0].position);
    }
  }, [markers, loaded]);

  // Draw route
  useEffect(() => {
    if (!mapInstanceRef.current || !route) return;

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
          directionsRendererRef.current!.setDirections(result);
        }
      }
    );
  }, [route, loaded]);

  // Driver location marker
  useEffect(() => {
    if (!mapInstanceRef.current || !driverLocation) return;

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

  if (!loaded) {
    return (
      <div className={`${className} bg-muted flex items-center justify-center`}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return <div ref={mapRef} className={className} />;
};

export default GoogleMap;
