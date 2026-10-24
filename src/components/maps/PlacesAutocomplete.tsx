/// <reference types="google.maps" />
import React, { forwardRef, useEffect, useRef, useState } from "react";
import { type AddressResult, type LatLng, LOCAL_RADIUS_KM, formatDistance, searchAddresses } from "@/lib/addressSearch";

type AddressSuggestion = AddressResult;

interface PlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (place: { address: string; lat: number; lng: number }) => void;
  placeholder?: string;
  className?: string;
  icon?: React.ReactNode;
  /** Rank suggestions near this point first and show how far each one is. */
  near?: LatLng | null;
}

const PlacesAutocomplete = forwardRef<HTMLDivElement, PlacesAutocompleteProps>(({ 
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Search location...",
  className = "",
  icon,
  near,
}, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedAddressRef = useRef<string | null>(null);
  // Suggestions are for what the user types, not for values the page fills in
  // (detected location, a prefilled route), which would pop the list open unasked.
  const typedRef = useRef(false);
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
    if (!typedRef.current || selectedAddressRef.current === value) {
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
        setSuggestions(await searchAddresses(value, near, { signal: controller.signal }));
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
    // near is read when the user types; a moving centre shouldn't re-run the search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const selectSuggestion = (suggestion: AddressSuggestion) => {
    selectedAddressRef.current = suggestion.address;
    typedRef.current = false;
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
          typedRef.current = true;
          onChange(e.target.value);
        }}
        onBlur={() => setSuggestions([])}
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
                    <span className="block font-medium">{suggestion.title}</span>
                    <span className="flex justify-between gap-2 text-xs text-muted-foreground">
                      <span>{suggestion.area}</span>
                      {suggestion.distanceKm !== null && (
                        <span className={suggestion.distanceKm > LOCAL_RADIUS_KM ? "font-semibold text-destructive" : ""}>
                          {formatDistance(suggestion.distanceKm)} away
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!isSearching && typedRef.current && selectedAddressRef.current !== value && value.trim().length >= 3 && suggestions.length === 0 && (
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
