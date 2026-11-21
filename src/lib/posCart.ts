// Till maths for 1145 POS, in integer cents. It mirrors pos_sale_create()
// (20261120090000_merchant_pos.sql) so the screen shows what the database
// will charge; the database works it out again and its numbers are final.
// No imports, so tests can load it directly.

export type TenderMethod = "cash" | "card" | "eft" | "pay_1145";

export interface CartLine {
  /** Local key: product:variation, or a random one for open items. */
  key: string;
  product_id: string | null;
  variation_id: string | null;
  name: string;
  sku: string | null;
  quantity: number;
  /** Catalogue price per unit. */
  list_price_minor: number;
  /** Price charged per unit (differs from the list price only after a manager's change). */
  unit_price_minor: number;
  /** Discount on the whole line, in cents. */
  discount_minor: number;
  /** Units in stock when added (null when stock isn't tracked). */
  stock: number | null;
}

export interface Tender {
  id: string;
  method: TenderMethod;
  amount_minor: number;
  reference?: string;
  payment_request_id?: string;
}

export interface CartTotals {
  items: number;
  /** List prices x quantity. */
  subtotal_minor: number;
  /** Charged prices x quantity, before discounts. */
  charged_minor: number;
  line_discounts_minor: number;
  sale_discount_minor: number;
  /** subtotal - total: price changes and discounts together. */
  discount_minor: number;
  total_minor: number;
  /** VAT included in the total (0 when the store isn't VAT registered). */
  vat_minor: number;
  /** Line plus sale discounts as a share of charged prices, in basis points. */
  discount_bp: number;
}

export const lineTotal = (l: Pick<CartLine, "quantity" | "unit_price_minor" | "discount_minor">) =>
  Math.max(0, l.unit_price_minor * l.quantity - l.discount_minor);

/** VAT included in a VAT-inclusive amount (15% → 1500 bp), rounded half up like Postgres round(). */
export const vatIncluded = (totalMinor: number, rateBp: number) =>
  rateBp > 0 ? Math.round((totalMinor * rateBp) / (10000 + rateBp)) : 0;

export function cartTotals(lines: CartLine[], saleDiscountMinor: number, vatRateBp: number): CartTotals {
  let items = 0, subtotal = 0, charged = 0, lineDiscounts = 0, afterLines = 0;
  for (const l of lines) {
    items += l.quantity;
    subtotal += l.list_price_minor * l.quantity;
    charged += l.unit_price_minor * l.quantity;
    lineDiscounts += Math.min(l.discount_minor, l.unit_price_minor * l.quantity);
    afterLines += lineTotal(l);
  }
  const saleDiscount = Math.min(Math.max(0, saleDiscountMinor), afterLines);
  const total = afterLines - saleDiscount;
  const discounts = lineDiscounts + saleDiscount;
  return {
    items,
    subtotal_minor: subtotal,
    charged_minor: charged,
    line_discounts_minor: lineDiscounts,
    sale_discount_minor: saleDiscount,
    discount_minor: subtotal - total,
    total_minor: total,
    vat_minor: vatIncluded(total, vatRateBp),
    discount_bp: charged > 0 ? Math.round((discounts * 10000) / charged) : 0,
  };
}

/** True when the discounts need someone with operations access (same test as the database). */
export const discountNeedsManager = (t: CartTotals, limitBp: number) =>
  t.line_discounts_minor + t.sale_discount_minor > 0 &&
  (t.line_discounts_minor + t.sale_discount_minor) * 10000 > t.charged_minor * limitBp;

/** A percentage of an amount in cents, rounded to the cent. */
export const percentOf = (amountMinor: number, percent: number) =>
  Math.round((amountMinor * Math.min(Math.max(percent, 0), 100)) / 100);

export interface TenderState {
  cash_minor: number;
  noncash_minor: number;
  /** Still to pay (0 once covered). */
  due_minor: number;
  change_minor: number;
  /** Ready to complete. */
  complete: boolean;
  /** Why it can't complete yet (or null). */
  problem: string | null;
}

export function tenderState(totalMinor: number, tenders: Tender[]): TenderState {
  let cash = 0, noncash = 0;
  for (const t of tenders) {
    if (t.method === "cash") cash += t.amount_minor; else noncash += t.amount_minor;
  }
  const paid = cash + noncash;
  const due = Math.max(0, totalMinor - paid);
  const problem = noncash > totalMinor
    ? "Card, EFT and 1145 Pay can't be more than the total. Only cash gives change."
    : null;
  return {
    cash_minor: cash,
    noncash_minor: noncash,
    due_minor: due,
    change_minor: problem ? 0 : Math.max(0, paid - totalMinor),
    complete: !problem && due === 0,
    problem,
  };
}

/**
 * Quick cash buttons for an amount due: the exact amount, then the next round
 * amounts a customer is likely to hand over in rand notes.
 */
export function quickCash(dueMinor: number): number[] {
  if (dueMinor <= 0) return [];
  const out = new Set<number>([dueMinor]);
  for (const step of [1000, 2000, 5000, 10000, 20000]) {
    const up = Math.ceil(dueMinor / step) * step;
    if (up > dueMinor) out.add(up);
    if (out.size >= 5) break;
  }
  return [...out].sort((a, b) => a - b).slice(0, 5);
}

/** Adds one of something to the cart, or a unit more if it's already there. */
export function addToCart(lines: CartLine[], line: Omit<CartLine, "quantity" | "discount_minor">, quantity = 1): CartLine[] {
  const at = lines.findIndex((l) => l.key === line.key);
  if (at >= 0) {
    return lines.map((l, i) => (i === at ? { ...l, quantity: Math.min(9999, l.quantity + quantity) } : l));
  }
  return [...lines, { ...line, quantity: Math.min(9999, quantity), discount_minor: 0 }];
}

export function setQuantity(lines: CartLine[], key: string, quantity: number): CartLine[] {
  if (quantity <= 0) return lines.filter((l) => l.key !== key);
  return lines.map((l) => {
    if (l.key !== key) return l;
    const q = Math.min(9999, Math.floor(quantity));
    // Keep a line discount within the line.
    return { ...l, quantity: q, discount_minor: Math.min(l.discount_minor, l.unit_price_minor * q) };
  });
}
