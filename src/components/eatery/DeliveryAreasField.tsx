import React, { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, MapPinOff, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DeliveryZone } from "@/types/food";

export const MAX_DELIVERY_AREAS = 60;
const MAX_AREA_LENGTH = 60;

// Kinds of place that make sense as a delivery area.
const AREA_TYPES = new Set([
  "suburb", "neighbourhood", "quarter", "residential", "town", "city", "village", "hamlet", "township",
  "city_district", "borough", "administrative", "municipality", "locality",
]);

interface MapPlace {
  place_id: number;
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox?: [string, string, string, string]; // south, north, west, east
  category?: string;
  type?: string;
  addresstype?: string;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const tidy = (text: string) =>
  text.trim().replace(/\s+/g, " ").slice(0, MAX_AREA_LENGTH)
    .replace(/(^|[\s-])([a-zà-ÿ])/g, (_, lead: string, letter: string) => lead + letter.toUpperCase());

const toZone = (place: MapPlace): DeliveryZone => {
  const [south, north, west, east] = (place.boundingbox ?? []).map(Number);
  const zone: DeliveryZone = { name: tidy(place.name || place.display_name.split(",")[0]), lat: Number(place.lat), lng: Number(place.lon) };
  if ([south, north, west, east].every(Number.isFinite)) Object.assign(zone, { south, north, west, east });
  return zone;
};

interface DeliveryAreasFieldProps {
  zones: DeliveryZone[];
  onChange: (zones: DeliveryZone[]) => void;
}

/**
 * The suburbs and towns an eatery delivers to. Areas are picked from the map so that a
 * customer's address can be checked against them; an area the map doesn't know can still
 * be added by name, but can't be checked.
 */
const DeliveryAreasField: React.FC<DeliveryAreasFieldProps> = ({ zones, onChange }) => {
  const [entry, setEntry] = useState("");
  const [results, setResults] = useState<MapPlace[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const skipSearch = useRef(false);

  // Look the typed name up on the map (OpenStreetMap), a moment after typing stops.
  useEffect(() => {
    const text = entry.trim();
    if (skipSearch.current) { skipSearch.current = false; return; }
    if (text.length < 3) { setResults(null); setSearching(false); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ q: text, format: "jsonv2", addressdetails: "0", limit: "8", countrycodes: "za" });
        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal: controller.signal, headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error("search failed");
        const places: MapPlace[] = await response.json();
        const seen = new Set<string>();
        setResults(places.filter((p) => {
          const kind = p.addresstype || p.type || "";
          if (!(p.category === "place" || p.category === "boundary") || !AREA_TYPES.has(kind)) return false;
          const key = p.display_name.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).slice(0, 5));
      } catch (error) {
        if ((error as Error).name !== "AbortError") setResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 700);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [entry]);

  const add = (zone: DeliveryZone) => {
    if (!zone.name) return;
    if (zones.some((z) => same(z.name, zone.name))) { setNote(`${zone.name} is already on your list.`); return; }
    if (zones.length >= MAX_DELIVERY_AREAS) { setNote(`You can list up to ${MAX_DELIVERY_AREAS} areas.`); return; }
    onChange([...zones, zone]);
    setNote(null);
    skipSearch.current = true;
    setEntry("");
    setResults(null);
  };

  const typed = tidy(entry);
  const unchecked = zones.filter((z) => typeof z.south !== "number").length;

  return (
    <div>
      <Label htmlFor="eatery-delivery-area-entry">Areas you deliver to</Label>
      <p id="eatery-delivery-areas-help" className="mt-1 text-sm text-text-secondary">
        Search for the suburbs or towns you deliver food and drinks to and pick them from the list. At checkout the customer's
        address is checked against these areas on the map, and addresses outside them can't order. Leave the list empty to
        accept orders to any address.
      </p>

      <div className="relative mt-3">
        <Input
          id="eatery-delivery-area-entry"
          value={entry}
          onChange={(e) => { setEntry(e.target.value); setNote(null); }}
          // Enter must not submit the whole form; picking from the list is what adds an area.
          onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
          placeholder="Search for a suburb or town, e.g. Orlando West"
          aria-describedby="eatery-delivery-areas-help"
          autoComplete="off"
          className="h-11"
        />
        {searching && <Loader2 className="absolute right-3 top-3 h-5 w-5 animate-spin text-text-secondary" aria-hidden />}
      </div>

      {entry.trim().length >= 3 && results && (
        <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border" aria-label="Matching places">
          {results.map((place) => (
            <li key={place.place_id}>
              <button type="button" onClick={() => add(toZone(place))} className="flex w-full items-start gap-2 p-3 text-left text-sm hover:bg-surface-hover">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">{tidy(place.name || place.display_name.split(",")[0])}</span>
                  <span className="block truncate text-xs text-text-secondary">{place.display_name}</span>
                </span>
              </button>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => add({ name: typed })} className="flex w-full items-start gap-2 p-3 text-left text-sm hover:bg-surface-hover">
              <Plus className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
              <span>
                <span className="block font-medium text-foreground">{results.length ? `Add "${typed}" as typed instead` : `Not found on the map. Add "${typed}" anyway`}</span>
                <span className="block text-xs text-text-secondary">Addresses can't be checked against an area that isn't on the map.</span>
              </span>
            </button>
          </li>
        </ul>
      )}
      {note && <p role="status" className="mt-2 text-sm text-text-secondary">{note}</p>}

      {zones.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-border p-3 text-sm text-text-secondary">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden /> No areas listed: you currently deliver to any address.
        </p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label={`Delivery areas (${zones.length})`}>
          {zones.map((zone) => {
            const onMap = typeof zone.south === "number";
            return (
              <li
                key={zone.name}
                className={onMap
                  ? "inline-flex items-center gap-1 rounded-full bg-surface-selected py-1 pl-3 pr-1 text-sm font-medium text-brand"
                  : "inline-flex items-center gap-1 rounded-full border border-dashed border-border py-1 pl-3 pr-1 text-sm font-medium text-foreground"}
              >
                {onMap ? <MapPin className="h-3.5 w-3.5" aria-hidden /> : <MapPinOff className="h-3.5 w-3.5 text-text-secondary" aria-hidden />}
                {zone.name}
                {!onMap && <span className="sr-only"> (not on the map)</span>}
                <button
                  type="button" aria-label={`Remove ${zone.name}`}
                  className="flex h-7 min-h-0 w-7 items-center justify-center rounded-full hover:bg-surface-pressed"
                  onClick={() => onChange(zones.filter((z) => z.name !== zone.name))}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {unchecked > 0 && (
        <p className="mt-2 flex items-start gap-2 text-xs text-text-secondary">
          <MapPinOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {unchecked === 1 ? "One area isn't" : `${unchecked} areas aren't`} on the map (dashed outline). Orders to {unchecked === 1 ? "it" : "them"} are
          only accepted when the map names that area for the customer's address, or when the address can't be found and the customer chooses it.
        </p>
      )}
    </div>
  );
};

export default DeliveryAreasField;
