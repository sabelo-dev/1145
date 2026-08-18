/// <reference types="google.maps" />
import React, { forwardRef, useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "./GoogleMap";

interface AddressSuggestion {
  id: string;
  address: string;
  lat: number;
  lng: number;
}

interface PlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (place: { address: string; lat: number; lng: number }) => void;
  placeholder?: string;
  className?: string;
  icon?: React.ReactNode;
}

const isPrecisePlace = (place: google.maps.places.PlaceResult): boolean => {
  const types = new Set(place.types ?? []);
  const broadTypes = new Set([
    "locality",
    "administrative_area_level_1",
    "administrative_area_level_2",
    "country",
    "postal_code",
    "postal_town",
    "sublocality",
    "neighborhood",
    "route",
    "political",
  ]);

  if (types.size === 0) return false;
  return [...types].every((type) => !broadTypes.has(type));
};

const invalidPreciseTypes = new Set([
  "locality",
  "administrative_area_level_1",
  "administrative_area_level_2",
  "country",
  "postal_code",
  "postal_town",
  "sublocality",
  "neighborhood",
  "political",
]);

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
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (!cancelled) {
          setReady(true);
          setLoadError(false);
        }
      })
      .catch((error) => {
        console.error("Google Places loading error:", error);
        if (!cancelled) {
          setLoadError(true);
        }
      });

    return () => {
      cancelled = true;
    };
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
        fields: ["formatted_address", "geometry", "name", "types", "place_id"],
        strictBounds: false,
        types: ["address", "establishment"],
      });

      const listener = autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const location = place.geometry?.location;
        const rawAddress = place.formatted_address || place.name || inputRef.current?.value || "";

        if (!location || !rawAddress) {
          return;
        }

        const placeTypes = new Set(place.types ?? []);
        const hasBroadType = [...placeTypes].some((type) => invalidPreciseTypes.has(type));

        if (hasBroadType) {
          console.warn("Google Places rejected non-address result for precise location:", place.formatted_address, [...placeTypes]);
          onChange(inputRef.current?.value || rawAddress);
          return;
        }

        const finalAddress = isPrecisePlace(place) ? rawAddress : place.name || rawAddress;

        onChange(finalAddress);
        onPlaceSelect({
          address: finalAddress,
          lat: location.lat(),
          lng: location.lng(),
        });
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

  // Google Places needs a configured, billing-enabled API key. Keep address
  // search useful when it is unavailable by falling back to OpenStreetMap's
  // public geocoder. The debounce also keeps requests within its public usage
  // guidance and avoids returning stale results while the user is typing.
  useEffect(() => {
    if (!loadError || value.trim().length < 3) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsSearching(true);

      try {
        const params = new URLSearchParams({
          q: value.trim(),
          format: "jsonv2",
          addressdetails: "1",
          limit: "5",
          countrycodes: "za",
        });
        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });

        if (!response.ok) throw new Error("Address search failed");

        const results: Array<{ place_id: number; display_name: string; lat: string; lon: string }> = await response.json();
        setSuggestions(
          results
            .map((place) => ({
              id: String(place.place_id),
              address: place.display_name,
              lat: Number(place.lat),
              lng: Number(place.lon),
            }))
            .filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng)),
        );
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 800);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [loadError, value]);

  const selectSuggestion = (suggestion: AddressSuggestion) => {
    onChange(suggestion.address);
    onPlaceSelect(suggestion);
    setSuggestions([]);
  };

  const openGoogleMapsSearch = () => {
    const query = value.trim();
    if (!query) return;
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

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
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            {isSearching ? "Searching addresses..." : "Address suggestions powered by OpenStreetMap."}
          </p>
          {suggestions.length > 0 && (
            <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-input bg-popover py-1 text-sm text-popover-foreground shadow-lg">
              {suggestions.map((suggestion) => (
                <li key={suggestion.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-muted focus:bg-muted focus:outline-none"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectSuggestion(suggestion)}
                  >
                    {suggestion.address}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!isSearching && value.trim().length >= 3 && suggestions.length === 0 && (
            <button
              type="button"
              className="mt-1 text-xs font-medium text-primary underline underline-offset-2"
              onClick={openGoogleMapsSearch}
            >
              Not listed? Find it in Google Maps
            </button>
          )}
        </>
      )}
    </div>
  );
});

PlacesAutocomplete.displayName = "PlacesAutocomplete";

export default PlacesAutocomplete;
