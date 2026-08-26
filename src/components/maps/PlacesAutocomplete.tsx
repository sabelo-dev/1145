/// <reference types="google.maps" />
import React, { forwardRef, useEffect, useRef, useState } from "react";

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

const PlacesAutocomplete = forwardRef<HTMLDivElement, PlacesAutocompleteProps>(({ 
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Search location...",
  className = "",
  icon,
}, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedAddressRef = useRef<string | null>(null);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value;
    }
  }, [value]);

  // Keep destination entry independent of the embedded Google widget. Provider
  // authorization errors otherwise render Google's own blocking dialog over
  // the ride form. Manual entry remains available if search is unavailable.
  useEffect(() => {
    if (selectedAddressRef.current === value) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    if (value.trim().length < 3) {
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
  }, [value]);

  const selectSuggestion = (suggestion: AddressSuggestion) => {
    selectedAddressRef.current = suggestion.address;
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
        onChange={(e) => {
          selectedAddressRef.current = null;
          onChange(e.target.value);
        }}
        placeholder={placeholder}
        autoComplete="off"
        className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${icon ? "pl-10" : ""}`}
      />
      {(
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            {isSearching ? "Searching addresses..." : "Enter an address or choose a suggestion."}
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
          {!isSearching && selectedAddressRef.current !== value && value.trim().length >= 3 && suggestions.length === 0 && (
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
