export type NormalizedTier = 'starter' | 'bronze' | 'silver' | 'gold';

const VALID: NormalizedTier[] = ['starter', 'bronze', 'silver', 'gold'];

/**
 * Vendors may carry legacy/among-status tier values such as "trial" or "free".
 * Normalize any unknown value to "starter" so tier config lookups never fail.
 */
export function normalizeTier(tier?: string | null): NormalizedTier {
  const t = (tier || '').toLowerCase();
  return (VALID as string[]).includes(t) ? (t as NormalizedTier) : 'starter';
}
