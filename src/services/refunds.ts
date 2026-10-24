import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

// Refund and return requests. Every write goes through a database function
// (see migration 20261024110000_order_refund_requests); no money moves here.

export type RefundRequest = Tables<"order_refund_requests">;

export interface RefundRequestItem {
  order_item_id: string;
  product_id: string;
  quantity: number;
  price: number;
}

export const REFUND_REASONS: { value: string; label: string }[] = [
  { value: "not_received", label: "I haven't received it" },
  { value: "damaged", label: "It arrived damaged" },
  { value: "wrong_item", label: "I got the wrong item" },
  { value: "not_as_described", label: "It's not as described" },
  { value: "changed_mind", label: "I changed my mind" },
  { value: "other", label: "Something else" },
];

export const reasonLabel = (reason: string) =>
  REFUND_REASONS.find((r) => r.value === reason)?.label ?? reason;

export const REFUND_STATUS_LABELS: Record<string, string> = {
  requested: "Waiting for review",
  approved: "Approved, refund on its way",
  rejected: "Declined",
  withdrawn: "Withdrawn",
  completed: "Refunded",
};

/** Paid orders that are on their way can be refunded; delivered ones returned. */
export const canRequestRefund = (status: string, paymentStatus?: string | null) =>
  paymentStatus === "paid" && ["processing", "shipped", "in_transit", "out_for_delivery", "delivered"].includes(status);

export const formatRand = (amount: number | null | undefined) => `R${Number(amount ?? 0).toFixed(2)}`;

async function call<T>(promise: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return data as T;
}

export const requestRefund = (orderId: string, reason: string, note: string, itemIds: string[]) =>
  call<{ request_id: string; kind: string; amount_requested: number }>(
    supabase.rpc("customer_request_refund", { p_order_id: orderId, p_reason: reason, p_note: note, p_item_ids: itemIds }),
  );

export const withdrawRefundRequest = (requestId: string) =>
  call<void>(supabase.rpc("customer_withdraw_refund_request", { p_request_id: requestId }));

export const decideRefundRequest = (requestId: string, approve: boolean, note?: string, amount?: number) =>
  call<{ status: string; amount_approved: number }>(
    supabase.rpc("refund_request_decide", { p_request_id: requestId, p_approve: approve, p_note: note, p_amount: amount }),
  );

export const completeRefundRequest = (requestId: string, reference: string) =>
  call<void>(supabase.rpc("refund_request_complete", { p_request_id: requestId, p_reference: reference }));

/** Requests visible to the caller (their own, their stores', or all for admins), newest first. */
export async function listRefundRequests(filter: { orderIds?: string[]; status?: string } = {}) {
  let query = supabase.from("order_refund_requests").select("*").order("created_at", { ascending: false });
  if (filter.orderIds) query = query.in("order_id", filter.orderIds);
  if (filter.status) query = query.eq("status", filter.status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}
