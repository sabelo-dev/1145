/**
 * Where a merchant delivers, read from `merchants.shipping_regions`.
 *
 * The column holds countries ("South Africa", "Kenya", ...) and, optionally,
 * South African provinces. Listing provinces narrows South African delivery
 * to those provinces; "South Africa" alone (or an empty list) means
 * nationwide. Kept free of app imports so the node tests can load it.
 */
export const SA_PROVINCES = [
  "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo",
  "Mpumalanga", "North West", "Northern Cape", "Western Cape",
] as const;

export type Province = (typeof SA_PROVINCES)[number];

const norm = (s: string) => s.trim().toLowerCase();
const PROVINCE_KEYS = new Set(SA_PROVINCES.map(norm));

export const isProvince = (region: string) => PROVINCE_KEYS.has(norm(region));

/** The provinces a merchant has limited itself to (empty = no limit). */
export const provincesOf = (regions: readonly string[] | null | undefined) =>
  (regions ?? []).filter(isProvince);

/**
 * Whether a merchant with these regions delivers within South Africa and,
 * when a province is given, to that province.
 */
export function deliversTo(regions: readonly string[] | null | undefined, province?: string | null): boolean {
  const list = regions ?? [];
  if (list.length === 0) return true; // unrestricted
  const provinces = provincesOf(list);
  const servesSA = provinces.length > 0 || list.some((r) => norm(r) === "south africa");
  if (!servesSA) return false;
  if (!province || provinces.length === 0) return true;
  return PROVINCE_KEYS.has(norm(province)) && provinces.some((p) => norm(p) === norm(province));
}

/** Replaces the province part of a region list, keeping countries as they are. */
export function withProvinces(regions: readonly string[], provinces: readonly string[]): string[] {
  const countries = regions.filter((r) => !isProvince(r));
  if (provinces.length && !countries.some((r) => norm(r) === "south africa")) countries.unshift("South Africa");
  return [...countries, ...SA_PROVINCES.filter((p) => provinces.includes(p))];
}

/** A short human label, e.g. "Nationwide" or "Gauteng, Western Cape". */
export function coverageLabel(regions: readonly string[] | null | undefined): string | null {
  if (!deliversTo(regions)) return null;
  const provinces = provincesOf(regions);
  if (provinces.length === 0 || provinces.length === SA_PROVINCES.length) return "Nationwide";
  return provinces.length <= 2 ? provinces.join(", ") : `${provinces.length} provinces`;
}
