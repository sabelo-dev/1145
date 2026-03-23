/// <reference types="@types/google.maps" />
import React, { forwardRef, useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "./GoogleMap";

interface PlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (place: { address: string; lat: number; lng: number }) => void;
  placeholder?: string;
  className?: string;
  icon?: React.ReactNode;
}

const PlacesAutocomplete = forwardRef<HTMLDivElement, PlacesAutocompleteProps>(({ 
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Search location...",
  className = "",
  icon,
}, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
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
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value;
    }
  }, [value]);

  useEffect(() => {
    if (!ready || loadError || !inputRef.current || autocompleteRef.current) return;

    try {
      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: "za" },
        fields: ["formatted_address", "geometry", "name"],
      });

      const listener = autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const address = place.formatted_address || place.name || inputRef.current?.value || "";
        const location = place.geometry?.location;

        onChange(address);

        if (location) {
          onPlaceSelect({
            address,
            lat: location.lat(),
            lng: location.lng(),
          });
        }
      });

      autocompleteRef.current = autocomplete;

      return () => {
        listener.remove();
        if (autocompleteRef.current === autocomplete) {
          autocompleteRef.current = null;
        }
      };
    } catch {
      console.warn("Google Autocomplete unavailable, falling back to manual input");
      setLoadError(true);
    }
  }, [ready, loadError, onChange, onPlaceSelect]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">{icon}</div>}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${icon ? "pl-10" : ""}`}
      />
      {loadError && (
        <p className="mt-1 text-xs text-muted-foreground">Autocomplete unavailable, enter address manually.</p>
      )}
    </div>
  );
});

PlacesAutocomplete.displayName = "PlacesAutocomplete";

export default PlacesAutocomplete;
