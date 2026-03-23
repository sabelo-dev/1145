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

const INPUT_SYNC_DELAYS = [0, 100, 300, 700, 1200];

const PlacesAutocomplete = forwardRef<HTMLDivElement, PlacesAutocompleteProps>(({ 
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Search location...",
  className = "",
  icon,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const syncInnerInput = (nextValue: string) => {
    const inner = elementRef.current?.querySelector("input") as HTMLInputElement | null;
    if (!inner) return null;
    if (inner.value !== nextValue) {
      inner.value = nextValue;
    }
    if (inner.placeholder !== placeholder) {
      inner.placeholder = placeholder;
    }
    return inner;
  };

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
    if (!elementRef.current) return;
    const timers = INPUT_SYNC_DELAYS.map((delay) =>
      setTimeout(() => {
        syncInnerInput(value);
      }, delay)
    );

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [placeholder, ready, value]);

  useEffect(() => {
    if (!ready || loadError || !containerRef.current || elementRef.current) return;

    try {
      const autocomplete = new google.maps.places.PlaceAutocompleteElement({
        componentRestrictions: { country: "za" },
      });

      autocomplete.style.width = "100%";
      autocomplete.style.height = "40px";
      autocomplete.style.fontSize = "14px";

      const handlePlaceSelect = async (event: Event) => {
        const place = (event as any).place;
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
      };

      autocomplete.addEventListener("gmp-placeselect", handlePlaceSelect);

      let removeInputListener: (() => void) | null = null;
      const bindInnerInput = () => {
        if (removeInputListener) {
          syncInnerInput(value);
          return;
        }

        const inner = syncInnerInput(value);
        if (!inner) return;

        const handleInput = (event: Event) => {
          onChange((event.target as HTMLInputElement).value);
        };

        inner.addEventListener("input", handleInput);
        removeInputListener = () => inner.removeEventListener("input", handleInput);
      };

      const timers = INPUT_SYNC_DELAYS.map((delay) =>
        setTimeout(() => {
          bindInnerInput();
        }, delay)
      );

      containerRef.current.appendChild(autocomplete);
      elementRef.current = autocomplete;
      syncInnerInput(value);

      return () => {
        timers.forEach(clearTimeout);
        removeInputListener?.();
        autocomplete.removeEventListener("gmp-placeselect", handlePlaceSelect);
        autocomplete.remove();
        if (elementRef.current === autocomplete) {
          elementRef.current = null;
        }
      };
    } catch {
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
    <div ref={ref} className={`relative ${className}`}>
      {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">{icon}</div>}
      <div ref={containerRef} className={`w-full [&_input]:flex [&_input]:h-10 [&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:border-input [&_input]:bg-background [&_input]:px-3 [&_input]:py-2 [&_input]:text-sm [&_input]:text-foreground [&_input]:ring-offset-background [&_input]:placeholder:text-muted-foreground [&_input]:focus-visible:outline-none [&_input]:focus-visible:ring-2 [&_input]:focus-visible:ring-ring [&_input]:focus-visible:ring-offset-2 ${icon ? "[&_input]:pl-10" : ""}`} />
    </div>
  );
});

PlacesAutocomplete.displayName = "PlacesAutocomplete";

export default PlacesAutocomplete;
