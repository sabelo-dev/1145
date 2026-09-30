import { supabase } from "@/integrations/supabase/client";
import { UCOIN_RAND_VALUE } from "@/types/ucoin";

/** A reward rule from the UC catalogue (public.mining_activities). */
export interface RewardRule {
  code: string;
  display_name: string;
  description: string | null;
  reward_mg: number;
  reward_kind: "fixed" | "percent" | "range";
  min_reward: number | null;
  max_reward: number | null;
  daily_cap: number | null;
  audience: string | null;
  conditions: string | null;
  admin_granted: boolean;
  sort_order: number;
}

/** "R5.00" for 50 UC (1 UC = R0.10). */
export const ucToRand = (uc: number) => `R${(uc * UCOIN_RAND_VALUE).toFixed(2)}`;

/** Human label for a rule's reward, e.g. "100 UC", "20–100 UC", "1–3% back". */
export const ruleRewardLabel = (rule: RewardRule) =>
  rule.reward_kind === "percent"
    ? `${rule.min_reward}–${rule.max_reward}% back`
    : rule.reward_kind === "range"
      ? `${Number(rule.min_reward).toLocaleString()}–${Number(rule.max_reward).toLocaleString()} UC`
      : `${Number(rule.reward_mg).toLocaleString()} UC`;

export async function fetchRewardRules(): Promise<RewardRule[]> {
  const { data, error } = await supabase
    .from("mining_activities")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as RewardRule[];
}

/**
 * Call a database function that is not in the generated Supabase types yet
 * (added by 20261001090000_uc_ecosystem.sql).
 */
export async function callRewardRpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const rpc = supabase.rpc as unknown as (
    name: string,
    params?: Record<string, unknown>,
  ) => Promise<{ data: T | null; error: { message: string } | null }>;
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}
