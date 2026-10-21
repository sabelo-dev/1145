// Merchant AI: store access, the order console, payment requests and the
// 1145 AI assistant. Every call here is checked again by the database or the
// edge function; nothing in the browser decides access or amounts.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { submitPayFastForm } from "@/lib/payments";
import { geocodeAddress } from "@/lib/navigation";

const db = supabase as unknown as SupabaseClient;

/** Raised when this database does not have the Merchant AI migrations (20261021*) yet. */
export class MerchantAiNotInstalledError extends Error {
  constructor() {
    super("Merchant AI is not installed on this database yet. Apply the 20261021 migrations first.");
    this.name = "MerchantAiNotInstalledError";
  }
}

// PostgREST: PGRST202 = no such function, PGRST205 = no such table (or not in its schema cache yet).
const NOT_INSTALLED_CODES = new Set(["PGRST202", "PGRST205"]);

export const toMerchantAiError = (error: { code?: string; message: string }) =>
  NOT_INSTALLED_CODES.has(error.code ?? "") ? new MerchantAiNotInstalledError() : new Error(error.message);

export const isNotInstalled = (error: unknown) => error instanceof MerchantAiNotInstalledError;

const rpc = async <T = void>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
  const { data, error } = await db.rpc(name, args);
  if (error) throw toMerchantAiError(error);
  return data as T;
};

export type StorePermission = "orders" | "catalog" | "payments" | "insights" | "settings";
export type MerchantFeature = "order_console" | "payment_requests" | "ai_assistant";
export type StoreRole = "owner" | "manager" | "cashier" | "catalog_editor" | "finance";

export interface StoreAccess {
  store_id: string;
  store_name: string;
  store_slug: string;
  merchant_id: string;
  role: StoreRole;
  permissions: StorePermission[];
  features: MerchantFeature[];
  pickup_address: { street: string; city: string; province?: string; phone?: string; lat?: number; lng?: number } | null;
}

export const fetchMyStoreAccess = () => rpc<StoreAccess[]>("merchant_my_access");

export const canUse = (access: StoreAccess | undefined, permission: StorePermission, feature?: MerchantFeature) =>
  !!access && access.permissions.includes(permission) && (!feature || access.features.includes(feature));

/** A fresh key per user action, so a retried request is not applied twice. */
export const newRequestKey = () => crypto.randomUUID();

// ------------------------------------------------------------------ team

export interface StoreMember {
  id: string;
  user_id: string;
  role: Exclude<StoreRole, "owner">;
  status: "active" | "suspended";
  name: string | null;
  email: string | null;
  created_at: string;
}

export const ROLE_LABELS: Record<StoreRole, string> = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Cashier",
  catalog_editor: "Catalogue editor",
  finance: "Finance",
};

export const fetchStoreMembers = (storeId: string) => rpc<StoreMember[]>("store_member_list", { p_store_id: storeId });

export const upsertStoreMember = (storeId: string, email: string, role: StoreMember["role"]) =>
  rpc("store_member_upsert", { p_store_id: storeId, p_email: email, p_role: role });

export const setStoreMemberStatus = (memberId: string, status: StoreMember["status"]) =>
  rpc("store_member_set_status", { p_member_id: memberId, p_status: status });

// ---------------------------------------------------------------- orders

export type ConsoleStatus = "pending" | "accepted" | "preparing" | "ready" | "shipped" | "out_for_delivery" | "delivered" | "mixed";

export interface ConsoleOrder {
  order_id: string;
  created_at: string;
  shipping_method: string | null;
  notes: string | null;
  customer_first_name: string | null;
  customer_city: string | null;
  status: ConsoleStatus;
  store_total_minor: number;
  last_action_at: string | null;
  delivery_status: string | null;
  single_store: boolean;
  has_delivery_address: boolean;
  items: Array<{ item_id: string; product_id: string; name: string | null; quantity: number; unit_price_minor: number }>;
}

/** The step after each status, and what the button says. */
export const NEXT_STEP: Partial<Record<ConsoleStatus, { to: ConsoleStatus; label: string }>> = {
  pending: { to: "accepted", label: "Accept" },
  accepted: { to: "preparing", label: "Start preparing" },
  preparing: { to: "ready", label: "Mark ready" },
  ready: { to: "shipped", label: "Dispatched" },
};

export const fetchOrderQueue = (storeId: string, includeRecent = false) =>
  rpc<ConsoleOrder[]>("merchant_order_queue", { p_store_id: storeId, p_include_recent: includeRecent });

export const advanceOrder = (storeId: string, orderId: string, to: ConsoleStatus, requestKey: string) =>
  rpc<{ order_id: string; status: ConsoleStatus; repeated: boolean }>("merchant_order_advance", {
    p_store_id: storeId,
    p_order_id: orderId,
    p_to_status: to,
    p_idempotency_key: requestKey,
  });

// ------------------------------------------------------ payment requests

export interface PaymentRequest {
  id: string;
  store_id: string;
  public_token: string;
  description: string;
  reference: string | null;
  amount_minor: number;
  currency: "ZAR";
  status: "pending" | "paid" | "expired" | "cancelled" | "refund_due";
  expires_at: string;
  paid_at: string | null;
  created_at: string;
}

export interface PublicPaymentRequest {
  store_name: string;
  store_logo_url: string | null;
  description: string;
  reference: string | null;
  amount_minor: number;
  currency: "ZAR";
  status: PaymentRequest["status"];
  expires_at: string;
  paid_at: string | null;
}

/** Shown as expired once the time has passed, even before anything updates the row. */
export const effectiveStatus = (r: Pick<PaymentRequest, "status" | "expires_at">): PaymentRequest["status"] =>
  r.status === "pending" && new Date(r.expires_at).getTime() <= Date.now() ? "expired" : r.status;

export const paymentLink = (token: string) => `${window.location.origin}/pay/${token}`;

export const fetchPaymentRequests = async (storeId: string) => {
  const { data, error } = await db
    .from("merchant_payment_requests")
    .select("id, store_id, public_token, description, reference, amount_minor, currency, status, expires_at, paid_at, created_at")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw toMerchantAiError(error);
  return (data ?? []) as PaymentRequest[];
};

export const createPaymentRequest = (input: {
  storeId: string;
  amountMinor: number;
  description: string;
  reference?: string;
  expiresInMinutes: number;
  requestKey: string;
}) =>
  rpc<PaymentRequest>("merchant_payment_request_create", {
    p_store_id: input.storeId,
    p_amount_minor: input.amountMinor,
    p_description: input.description,
    p_reference: input.reference ?? null,
    p_expires_in_minutes: input.expiresInMinutes,
    p_idempotency_key: input.requestKey,
  });

export const cancelPaymentRequest = (requestId: string) =>
  rpc<PaymentRequest>("merchant_payment_request_cancel", { p_request_id: requestId });

export const fetchPublicPaymentRequest = (token: string) =>
  rpc<PublicPaymentRequest | null>("payment_request_public", { p_token: token });

/** Sends the payer to PayFast. The amount comes from the database, not from here. */
export async function payPaymentRequest(token: string) {
  const { data, error } = await supabase.functions.invoke("merchant-payment-request", { body: { token } });
  if (error) throw new Error(error.message || "Could not start the payment");
  if (!data?.success) throw new Error(data?.error || "Could not start the payment");
  await submitPayFastForm(data.action, data.formData);
}

// ------------------------------------------------------------- assistant

export interface AssistantReply {
  answer: string;
  conversation_id: string;
  tool_execution_ids: string[];
  metrics: Array<{ tool: string; result: { as_of?: string; definition?: string; period?: { from: string; to: string } } }>;
  drafts: Array<{ id: string; target_type: "product_description" | "promotion"; product_id: string | null }>;
  data_as_of: string | null;
  timezone: string;
}

export async function askAssistant(storeId: string, question: string, conversationId: string | null) {
  const { data, error } = await supabase.functions.invoke("merchant-ai", {
    body: { store_id: storeId, question, conversation_id: conversationId },
  });
  if (error) {
    // The function's own message (quota, access) is in the response body.
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(body?.error || error.message || "1145 AI could not answer");
  }
  return data as AssistantReply;
}

export interface AiDraft {
  id: string;
  store_id: string;
  target_type: "product_description" | "promotion";
  product_id: string | null;
  content: string;
  approval_state: "draft" | "approved" | "rejected";
  created_at: string;
  decided_at: string | null;
  products?: { name: string } | null;
}

export const fetchAiDrafts = async (storeId: string) => {
  const { data, error } = await db
    .from("merchant_ai_drafts")
    .select("id, store_id, target_type, product_id, content, approval_state, created_at, decided_at, products(name)")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw toMerchantAiError(error);
  return (data ?? []) as unknown as AiDraft[];
};

export const decideAiDraft = (draftId: string, decision: "approve" | "reject", content?: string) =>
  rpc<AiDraft>("merchant_ai_draft_decide", { p_draft_id: draftId, p_decision: decision, p_content: content ?? null });

// ----------------------------------------------------------------- admin

export const setMerchantFeature = (merchantId: string, flag: MerchantFeature, enabled: boolean, cohort?: string) =>
  rpc("admin_set_merchant_feature", { p_merchant_id: merchantId, p_flag: flag, p_enabled: enabled, p_cohort: cohort ?? null });

// -------------------------------------------------------------- delivery

/** Where drivers collect from. The browser geocodes it; the database checks the pin is in South Africa. */
export async function setPickupAddress(storeId: string, address: { street: string; city: string; province: string; phone: string }) {
  const coords = await geocodeAddress(`${address.street}, ${address.city}, ${address.province}, South Africa`).catch(() => null);
  return rpc("store_set_pickup_address", {
    p_store_id: storeId,
    p_street: address.street,
    p_city: address.city,
    p_province: address.province,
    p_phone: address.phone,
    p_lat: coords?.lat ?? null,
    p_lng: coords?.lng ?? null,
  });
}

/** Posts the driver job: pickup from the store, drop-off from the order's own address. */
export async function requestOrderDelivery(storeId: string, orderId: string) {
  const address = await rpc<string | null>("merchant_order_drop_address", { p_store_id: storeId, p_order_id: orderId });
  const coords = address ? await geocodeAddress(address).catch(() => null) : null;
  return rpc<{ delivery_job_id: string; status: string; repeated: boolean }>("merchant_order_request_delivery", {
    p_store_id: storeId,
    p_order_id: orderId,
    p_drop_lat: coords?.lat ?? null,
    p_drop_lng: coords?.lng ?? null,
  });
}

export interface PilotMetrics {
  cohort: string | null;
  period: { from: string; to: string };
  as_of: string;
  merchants_in_cohort: number;
  active_merchants: number;
  weekly_active_merchants: Array<{ week_start: string; merchants: number }>;
  staff_members: number;
  orders_accepted_in_console: number;
  orders_dispatched_in_console: number;
  median_minutes_to_accept: number | null;
  payment_links_created: number;
  payment_links_paid: number;
  payment_link_completion_rate: number | null;
  payment_links_paid_minor: number;
  payment_links_refund_due: number;
  reconciliation_exceptions: Record<string, number>;
  ai_questions: number;
  ai_input_tokens: number;
  ai_output_tokens: number;
  ai_tool_errors: number;
  ai_drafts: { created: number; approved: number; rejected: number; approval_rate: number | null };
  merchants: Array<{
    merchant_id: string;
    business_name: string;
    last_active: string | null;
    active_days: number;
    orders_accepted: number;
    payment_links_paid: number;
    ai_questions: number;
  }>;
}

export const fetchPilotMetrics = (cohort: string | null, from: string, to: string) =>
  rpc<PilotMetrics>("admin_merchant_ai_pilot_metrics", { p_cohort: cohort, p_from: from, p_to: to });
