/// <reference types="@types/google.maps" />
import React, { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "./GoogleMap";

interface PlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (place: { address: string; lat: number; lng: number }) => void;
  placeholder?: string;
  className?: string;
  icon?: React.ReactNode;
}

const PlacesAutocomplete: React.FC<PlacesAutocompleteProps> = ({
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Search location...",
  className = "",
  icon,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    loadGoogleMaps()
      .then(() => {
        setReady(true);
        setLoadError(false);
      })
      .catch((error) => {
        console.error("Google Places loading error:", error);
        setLoadError(true);
      });
  }, []);

  useEffect(() => {
    if (!ready || loadError || !containerRef.current || elementRef.current) return;

    try {
      const autocomplete = new google.maps.places.PlaceAutocompleteElement({
        componentRestrictions: { country: "za" },
      });

      // Style the element to match our design
      autocomplete.style.width = "100%";
      autocomplete.style.height = "40px";
      autocomplete.style.fontSize = "14px";

      autocomplete.addEventListener("gmp-placeselect", async (event: any) => {
        const place = event.place;
        if (place) {
          await place.fetchFields({ fields: ["displayName", "formattedAddress", "location"] });
          const address = place.formattedAddress || "";
          const location = place.location;
          onChange(address);
          if (location) {
            onPlaceSelect({
              address,
              lat: location.lat(),
              lng: location.lng(),
            });
          }
        }
      });

      containerRef.current.appendChild(autocomplete);
      elementRef.current = autocomplete;
    } catch {
      // Fallback: PlaceAutocompleteElement not available, try legacy Autocomplete
      console.warn("PlaceAutocompleteElement not available, falling back to legacy input");
      setLoadError(true);
    }
  }, [ready, loadError, onChange, onPlaceSelect]);

  if (loadError) {
    return (
      <div className={`relative ${className}`}>
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">{icon}</div>}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${icon ? "pl-10" : ""}`}
          autoComplete="off"
        />
        <p className="mt-1 text-xs text-muted-foreground">Autocomplete unavailable, enter address manually.</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">{icon}</div>}
      <div ref={containerRef} className={`w-full [&_input]:flex [&_input]:h-10 [&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:border-input [&_input]:bg-background [&_input]:px-3 [&_input]:py-2 [&_input]:text-sm [&_input]:ring-offset-background [&_input]:placeholder:text-muted-foreground [&_input]:focus-visible:outline-none [&_input]:focus-visible:ring-2 [&_input]:focus-visible:ring-ring [&_input]:focus-visible:ring-offset-2 ${icon ? "[&_input]:pl-10" : ""}`} />
    </div>
  );
};

export default PlacesAutocomplete;
