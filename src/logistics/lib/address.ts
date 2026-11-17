import { geocodeAddress } from "@/lib/navigation";
import type { Address } from "./db";

/**
 * Best-effort city from a Google formatted address
 * ("12 Rivonia Rd, Sandhurst, Sandton, 2196, South Africa" → "Sandton").
 */
export function guessCity(formatted: string): string | undefined {
  const parts = formatted
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !/^\d{4,}$/.test(p) && !/^south africa$/i.test(p));
  if (parts.length >= 2) return parts[parts.length - 1].replace(/\s+\d{4,}$/, "");
  return undefined;
}

export function toAddress(formatted: string, coords?: { lat: number; lng: number } | null): Address {
  return {
    street: formatted,
    city: guessCity(formatted),
    country: "South Africa",
    ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
  };
}

/** Geocode a free-text address; keeps the text even when geocoding fails. */
export async function resolveAddress(formatted: string): Promise<Address> {
  const coords = await geocodeAddress(formatted);
  return toAddress(formatted, coords);
}

/** Minimal RFC-4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}
