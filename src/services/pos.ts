// 1145 POS: the till in the 1145 Orders app. Every call is checked again by
// the database (20261120090000_merchant_pos.sql): prices, discount limits,
// VAT, tenders and stock are decided there, not here.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toMerchantAiError } from "@/services/merchantAi";
import type { TenderMethod } from "@/lib/posCart";

const db = supabase as unknown as SupabaseClient;

const rpc = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
  const { data, error } = await db.rpc(name, args);
  if (error) throw toMerchantAiError(error);
  return data as T;
};

export const TENDER_LABELS: Record<TenderMethod, string> = {
  cash: "Cash",
  card: "Card",
  eft: "EFT",
  pay_1145: "1145 Pay",
};

// ---------------------------------------------------------------- settings

export interface PosSettings {
  store_id: string;
  store_name: string;
  store_address: { street?: string; city?: string; province?: string; phone?: string } | null;
  vat_registered: boolean;
  vat_number: string | null;
  vat_rate_bp: number;
  receipt_header: string | null;
  receipt_footer: string | null;
  cashier_max_discount_bp: number;
  allow_open_items: boolean;
}

export const fetchPosSettings = (storeId: string) => rpc<PosSettings>("pos_settings_get", { p_store_id: storeId });

export const savePosSettings = (storeId: string, s: Pick<PosSettings,
  "vat_registered" | "vat_number" | "receipt_header" | "receipt_footer" | "cashier_max_discount_bp" | "allow_open_items">) =>
  rpc<PosSettings>("pos_settings_set", {
    p_store_id: storeId,
    p_vat_registered: s.vat_registered,
    p_vat_number: s.vat_number,
    p_receipt_header: s.receipt_header,
    p_receipt_footer: s.receipt_footer,
    p_cashier_max_discount_bp: s.cashier_max_discount_bp,
    p_allow_open_items: s.allow_open_items,
  });

// --------------------------------------------------------------- catalogue

export interface PosVariation {
  variation_id: string;
  sku: string | null;
  attributes: Record<string, unknown> | null;
  stock: number;
  price_minor: number;
}

export interface PosProduct {
  product_id: string;
  name: string;
  sku: string | null;
  category: string;
  price_minor: number;
  track_stock: boolean;
  stock: number;
  image_url: string | null;
  variations: PosVariation[];
}

export const fetchPosCatalog = (storeId: string) => rpc<PosProduct[]>("pos_catalog", { p_store_id: storeId });

/** The product (and variant) whose SKU is exactly this scanned or typed code, ignoring case. */
export function findByCode(catalog: PosProduct[], code: string): { product: PosProduct; variation: PosVariation | null } | null {
  const c = code.trim().toLowerCase();
  if (!c) return null;
  for (const product of catalog) {
    const variation = product.variations.find((v) => v.sku?.toLowerCase() === c);
    if (variation) return { product, variation };
  }
  const product = catalog.find((p) => p.sku?.toLowerCase() === c);
  return product ? { product, variation: null } : null;
}

// ------------------------------------------------------------------ shifts

export interface ShiftReport {
  shift_id: string;
  register_name: string;
  status: "open" | "closed";
  opened_at: string;
  opened_by: string | null;
  closed_at: string | null;
  closed_by: string | null;
  opening_float_minor: number;
  sales_count: number;
  gross_minor: number;
  discount_minor: number;
  vat_minor: number;
  net_minor: number;
  voids_count: number;
  voids_minor: number;
  refunds_count: number;
  refunds_minor: number;
  by_method: Record<TenderMethod, number>;
  refunds_by_method: Record<"cash" | "card" | "eft", number>;
  pay_ins_minor: number;
  pay_outs_minor: number;
  expected_cash_minor: number;
  counted_cash_minor: number | null;
  variance_minor: number | null;
  close_note: string | null;
  cash_movements: Array<{ kind: "pay_in" | "pay_out"; amount_minor: number; reason: string; created_at: string }>;
}

export const fetchCurrentShift = (storeId: string, register: string) =>
  rpc<ShiftReport | null>("pos_shift_current", { p_store_id: storeId, p_register_name: register });

export const openShift = (storeId: string, register: string, floatMinor: number, requestKey: string) =>
  rpc<ShiftReport>("pos_shift_open", {
    p_store_id: storeId, p_register_name: register, p_opening_float_minor: floatMinor, p_idempotency_key: requestKey,
  });

export const recordCashMovement = (shiftId: string, kind: "pay_in" | "pay_out", amountMinor: number, reason: string, requestKey: string) =>
  rpc<ShiftReport>("pos_cash_movement", {
    p_shift_id: shiftId, p_kind: kind, p_amount_minor: amountMinor, p_reason: reason, p_idempotency_key: requestKey,
  });

export const closeShift = (shiftId: string, countedMinor: number, note: string) =>
  rpc<ShiftReport>("pos_shift_close", { p_shift_id: shiftId, p_counted_cash_minor: countedMinor, p_note: note || null });

export const fetchShifts = (storeId: string) => rpc<ShiftReport[]>("pos_shift_list", { p_store_id: storeId, p_limit: 30 });

// ------------------------------------------------------------------- sales

export type SaleStatus = "completed" | "partially_refunded" | "refunded" | "voided";

export interface PosSale {
  sale_id: string;
  store_id: string;
  shift_id: string;
  register_name: string;
  sale_number: number;
  status: SaleStatus;
  created_at: string;
  subtotal_minor: number;
  discount_minor: number;
  total_minor: number;
  vat_minor: number;
  vat_rate_bp: number;
  tendered_minor: number;
  change_minor: number;
  refunded_minor: number;
  customer_name: string | null;
  customer_phone: string | null;
  note: string | null;
  cashier: string | null;
  voided_at: string | null;
  void_reason: string | null;
  lines: Array<{
    line_id: string; product_id: string | null; variation_id: string | null; name: string; sku: string | null;
    quantity: number; list_price_minor: number; unit_price_minor: number; discount_minor: number; line_total_minor: number;
    refunded_quantity: number; refunded_minor: number;
  }>;
  payments: Array<{ method: TenderMethod; amount_minor: number; tendered_minor: number; reference: string | null }>;
  refunds: Array<{
    refund_id: string; refund_number: number; amount_minor: number; method: "cash" | "card" | "eft"; reason: string;
    restocked: boolean; lines: Array<{ line_id: string; name: string; quantity: number; amount_minor: number }>; created_at: string;
  }>;
  store: {
    name: string;
    address: { street?: string; city?: string; province?: string; phone?: string } | null;
    vat_number: string | null;
    receipt_header: string | null;
    receipt_footer: string | null;
  };
  repeated?: boolean;
}

export interface SaleSummary {
  sale_id: string;
  sale_number: number;
  status: SaleStatus;
  created_at: string;
  total_minor: number;
  refunded_minor: number;
  customer_name: string | null;
  register_name: string;
  items: number;
  methods: TenderMethod[] | null;
  cashier: string | null;
}

export interface NewSale {
  storeId: string;
  shiftId: string;
  lines: Array<{
    product_id: string | null; variation_id: string | null; name?: string; quantity: number;
    unit_price_minor?: number; discount_minor?: number;
  }>;
  saleDiscountMinor: number;
  payments: Array<{ method: TenderMethod; amount_minor: number; reference?: string; payment_request_id?: string }>;
  customerName?: string;
  customerPhone?: string;
  note?: string;
  requestKey: string;
}

export const createSale = (s: NewSale) =>
  rpc<PosSale>("pos_sale_create", {
    p_store_id: s.storeId,
    p_shift_id: s.shiftId,
    p_lines: s.lines,
    p_sale_discount_minor: s.saleDiscountMinor,
    p_payments: s.payments,
    p_customer_name: s.customerName || null,
    p_customer_phone: s.customerPhone || null,
    p_note: s.note || null,
    p_idempotency_key: s.requestKey,
  });

export const fetchSale = (saleId: string) => rpc<PosSale>("pos_sale_get", { p_sale_id: saleId });

export const fetchSales = (storeId: string, day: string | null, query: string | null) =>
  rpc<SaleSummary[]>("pos_sales_list", { p_store_id: storeId, p_day: day, p_query: query || null });

export const voidSale = (saleId: string, reason: string) => rpc<PosSale>("pos_sale_void", { p_sale_id: saleId, p_reason: reason });

export const refundSale = (input: {
  saleId: string; shiftId: string; lines: Array<{ line_id: string; quantity: number }>;
  method: "cash" | "card" | "eft"; reason: string; restock: boolean; requestKey: string;
}) =>
  rpc<PosSale>("pos_sale_refund", {
    p_sale_id: input.saleId, p_shift_id: input.shiftId, p_lines: input.lines, p_method: input.method,
    p_reason: input.reason, p_restock: input.restock, p_idempotency_key: input.requestKey,
  });

// ---------------------------------------------------------------- summary

export interface DaySummary {
  day: string;
  sales_count: number;
  gross_minor: number;
  discount_minor: number;
  vat_minor: number;
  refunds_minor: number;
  refunds_count: number;
  net_minor: number;
  voids_count: number;
  average_sale_minor: number;
  items_sold: number;
  by_method: Record<TenderMethod, number>;
  by_hour: Array<{ hour: number; total_minor: number; sales: number }>;
  top_items: Array<{ name: string; quantity: number; total_minor: number }>;
  shifts: ShiftReport[];
}

export const fetchDaySummary = (storeId: string, day: string) =>
  rpc<DaySummary>("pos_day_summary", { p_store_id: storeId, p_day: day });

/** Status of one 1145 Pay request (staff with the payments permission can read their store's requests). */
export async function fetchPayRequestStatus(requestId: string) {
  const { data, error } = await db
    .from("merchant_payment_requests")
    .select("id, status, amount_minor, expires_at, paid_at")
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw toMerchantAiError(error);
  return data as { id: string; status: "pending" | "paid" | "expired" | "cancelled" | "refund_due"; amount_minor: number; expires_at: string; paid_at: string | null } | null;
}

/** Sale number as printed: #000123. */
export const saleNo = (n: number) => `#${String(n).padStart(6, "0")}`;

// ---------------------------------------------------------- this device

const REGISTER_KEY = "1145.pos-register";

/** The till name this device rings sales up on (each device remembers its own). */
export function getRegisterName(): string {
  try { return localStorage.getItem(REGISTER_KEY) || "Till 1"; } catch { return "Till 1"; }
}
export function setRegisterName(name: string) {
  try { localStorage.setItem(REGISTER_KEY, name.trim() || "Till 1"); } catch { /* storage unavailable */ }
}
