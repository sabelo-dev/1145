import { supabase } from "@/integrations/supabase/client";

export async function payPurchaseWithUcoin(kind: "food" | "auction" | "service", id: string, total: number) {
  const { error } = await supabase.rpc("pay_purchase_with_ucoin" as never, { p_kind: kind, p_id: id, p_expected_minor: Math.round(total * 100) } as never);
  if (error) throw new Error(error.message);
}
