// Money in integer cents (minor units). Display and parsing only; arithmetic stays in cents.

/** Cents → "R 1 499,00". Display only; arithmetic stays in integer cents. */
export const formatMinor = (minor: number, currency = "ZAR") =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(minor / 100);

/** "12.50" → 1250, or null when it isn't a valid amount. Avoids floating-point maths on money. */
export const parseMinor = (input: string): number | null => {
  const match = /^\s*(\d{1,7})(?:[.,](\d{1,2}))?\s*$/.exec(input);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || 0);
};
