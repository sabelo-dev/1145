import { supabase } from '@/integrations/supabase/client';

export type SubscriptionTier = 'starter' | 'bronze' | 'silver' | 'gold';
export type BillingPeriod = 'monthly' | 'yearly';

export const TIER_ORDER: SubscriptionTier[] = ['starter', 'bronze', 'silver', 'gold'];

export const TIER_PRICING: Record<SubscriptionTier, Record<BillingPeriod, number>> = {
  starter: { monthly: 0, yearly: 0 },
  bronze: { monthly: 99, yearly: 990 },
  silver: { monthly: 249, yearly: 2490 },
  gold: { monthly: 499, yearly: 4990 },
};

export interface SubscriptionChangeResult {
  applied?: boolean;
  requiresPayment?: boolean;
  paymentUrl?: string;
  formData?: Record<string, string>;
  reference?: string;
  tier?: SubscriptionTier;
  error?: string;
}

async function callFunction(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('merchant-subscription', {
    body: { ...body, origin: window.location.origin },
  });

  if (error) {
    let details = error.message;
    try {
      // Surface the real edge function error instead of "non-2xx status code"
      const ctx = (error as unknown as { context?: Response }).context;
      if (ctx) {
        const text = await ctx.text();
        const parsed = JSON.parse(text);
        details = parsed.error || text;
      }
    } catch {
      /* keep original message */
    }
    throw new Error(details);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

/** Redirects the browser to PayFast via an auto-submitting form POST. */
export function redirectToPayFast(paymentUrl: string, formData: Record<string, string>) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = paymentUrl;
  Object.entries(formData).forEach(([key, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = String(value ?? '');
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

export async function changeSubscription(
  tier: SubscriptionTier,
  billingPeriod: BillingPeriod,
  reason?: string,
): Promise<SubscriptionChangeResult> {
  return await callFunction({ action: 'change', tier, billing_period: billingPeriod, reason });
}

export async function cancelSubscription(reason?: string): Promise<SubscriptionChangeResult> {
  return await callFunction({ action: 'cancel', reason });
}

export async function getSubscriptionStatus() {
  return await callFunction({ action: 'status' });
}
