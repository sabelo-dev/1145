import { supabase } from "@/integrations/supabase/client";
import { submitPayFastForm } from "@/lib/payments";

export interface FoundersAvailability {
  price: number;
  total: number;
  claimed: number;
  remaining: number;
  is_open: boolean;
  valid_months: number;
}

export interface FoundersPass {
  pass_number: number;
  claimed_at: string;
  expires_at: string;
}

// The founder pass tables and functions are newer than the generated Supabase
// types. Drop this cast after regenerating src/integrations/supabase/types.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** The public "X of 1,000 left" counter and the current price. */
export async function getFoundersAvailability(): Promise<FoundersAvailability | null> {
  const { data, error } = await db.rpc("founder_pass_availability");
  if (error || !data) return null;
  return {
    price: Number(data.price),
    total: Number(data.total),
    claimed: Number(data.claimed),
    remaining: Number(data.remaining),
    is_open: Boolean(data.is_open),
    valid_months: Number(data.valid_months),
  };
}

/** The signed-in user's pass, or null if they have none. */
export async function getMyFoundersPass(userId: string): Promise<FoundersPass | null> {
  const { data, error } = await db
    .from("founder_passes")
    .select("pass_number, claimed_at, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  return (data as FoundersPass | null) ?? null;
}

/**
 * Starts the PayFast payment for a pass and sends the user to PayFast.
 * `source` says where the buyer came from (the poster's utm_content).
 */
export async function claimFoundersPass(source?: string | null): Promise<void> {
  const { data, error } = await supabase.functions.invoke("founder-pass", {
    body: { origin: window.location.origin, source: source ?? null },
  });

  if (error) {
    let details = error.message;
    try {
      // Surface the function's own message instead of "non-2xx status code".
      const ctx = (error as unknown as { context?: Response }).context;
      if (ctx) {
        const text = await ctx.text();
        details = JSON.parse(text).error || text;
      }
    } catch {
      /* keep the original message */
    }
    throw new Error(details);
  }
  if (data?.error) throw new Error(data.error);

  await submitPayFastForm(data.paymentUrl, data.formData);
}

/** True when the user paid but no pass could be issued, so a refund is owed. */
export async function hasFoundersRefundDue(userId: string): Promise<boolean> {
  const { data, error } = await db
    .from("founder_pass_orders")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "refund_due")
    .limit(1);
  return !error && Array.isArray(data) && data.length > 0;
}
