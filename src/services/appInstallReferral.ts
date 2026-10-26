import { supabase } from "@/integrations/supabase/client";
import type { AppKey } from "@/config/appDownloads";
import { platform } from "@/lib/native";
import { getDeviceId } from "@/services/driverVerificationService";

export type AppInstallStatus =
  | "awarded"
  | "already_claimed"
  | "not_new"
  | "device_used"
  | "no_referrer"
  | "invalid_code";

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) throw new Error(error.message);
  return data as T;
}

/** Native apps only: rewards whoever invited this new account (claim_app_install). */
export async function claimAppInstall(app: AppKey, code?: string) {
  return rpc<{ status: AppInstallStatus; amount: number }>("claim_app_install", {
    p_app: app,
    p_platform: platform(),
    p_device_id: await getDeviceId(),
    p_code: code?.trim() || null,
  });
}

export const getAppInstallStats = () =>
  rpc<{ installs: number; earned: number }>("app_install_referral_stats");

export const getMyReferralCode = (userId: string) =>
  rpc<string>("get_or_create_referral_code", { p_user_id: userId });
