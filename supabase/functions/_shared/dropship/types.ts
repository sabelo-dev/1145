// Supplier-independent dropshipping contracts.
// Every supplier integration implements SupplierAdapter so new suppliers can be
// added without touching the platform logic.

export interface SupplierCredentials {
  [key: string]: string | undefined;
}

export interface SupplierVariantDTO {
  supplierVariantId: string;
  sku?: string;
  name?: string;
  attributes: Record<string, string>;
  imageUrl?: string;
  cost: number;
  shippingCost?: number;
  stock: number;
  weightGrams?: number;
}

export interface SupplierProductDTO {
  supplierProductId: string;
  sku?: string;
  name: string;
  description?: string;
  images: string[];
  category?: string;
  cost: number;
  currency: string;
  shippingCost?: number;
  stock: number;
  weightGrams?: number;
  warehouse?: string;
  variants: SupplierVariantDTO[];
  raw?: Record<string, unknown>;
}

export interface SupplierStockDTO {
  supplierVariantId: string;
  stock: number;
  cost?: number;
}

export interface SupplierOrderLine {
  supplierVariantId: string;
  quantity: number;
}

export interface SupplierOrderRequest {
  externalOrderNumber: string; // the 1145 order reference (idempotency key)
  lines: SupplierOrderLine[];
  shipping: {
    name: string;
    phone?: string;
    email?: string;
    street: string;
    city: string;
    province?: string;
    postalCode?: string;
    country: string;
    countryCode?: string;
  };
  shippingMethod?: string;
  remark?: string;
}

export interface SupplierOrderResult {
  supplierOrderNumber: string;
  status: string;
  cost?: number;
  shippingCost?: number;
  currency?: string;
}

export interface SupplierOrderStatus {
  supplierOrderNumber: string;
  status: string;
  carrier?: string;
  trackingNumber?: string;
  cost?: number;
  shippingCost?: number;
}

export interface SupplierTrackingEvent {
  status: string;
  description?: string;
  location?: string;
  occurredAt: string;
}

export interface SupplierTracking {
  carrier?: string;
  trackingNumber: string;
  status: string;
  estimatedDelivery?: string;
  events: SupplierTrackingEvent[];
}

export interface DiscoverParams {
  query?: string;
  category?: string;
  page?: number;
  pageSize?: number;
}

export interface SupplierAdapter {
  code: string;
  /** Verifies credentials / reachability. Throws on failure. */
  health(): Promise<{ ok: boolean; message?: string }>;
  discover(params: DiscoverParams): Promise<{ items: SupplierProductDTO[]; total: number }>;
  getProduct(supplierProductId: string): Promise<SupplierProductDTO>;
  getStock(supplierVariantIds: string[]): Promise<SupplierStockDTO[]>;
  createOrder(req: SupplierOrderRequest): Promise<SupplierOrderResult>;
  /** Used before any retry so an order is never submitted twice. */
  findOrderByExternalNumber(externalOrderNumber: string): Promise<SupplierOrderStatus | null>;
  getOrder(supplierOrderNumber: string): Promise<SupplierOrderStatus | null>;
  getTracking(trackingNumber: string): Promise<SupplierTracking | null>;
  verifyWebhook(req: Request, rawBody: string): Promise<boolean>;
}

/** Maps any supplier's wording onto the 1145 status vocabulary. */
export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "submitting",
  "supplier_created",
  "processing",
  "shipped",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "supplier_failure",
  "awaiting_supplier_action",
  "return_requested",
  "return_approved",
  "refunded",
] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];

export function normalizeSupplierStatus(raw: string | undefined | null): OrderStatus {
  const s = (raw || "").toLowerCase();
  if (!s) return "processing";
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("refund")) return "refunded";
  if (s.includes("deliver")) return s.includes("out") ? "out_for_delivery" : "delivered";
  if (s.includes("transit")) return "in_transit";
  if (s.includes("ship") || s.includes("fulfil") || s.includes("dispatch")) return "shipped";
  if (s.includes("unpaid") || s.includes("pending payment")) return "pending_payment";
  if (s.includes("created") || s.includes("confirm")) return "supplier_created";
  if (s.includes("fail") || s.includes("error")) return "supplier_failure";
  return "processing";
}
