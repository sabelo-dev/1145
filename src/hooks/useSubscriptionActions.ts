import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import {
  BillingPeriod,
  SubscriptionTier,
  TIER_ORDER,
  cancelSubscription,
  changeSubscription,
  redirectToPayFast,
} from '@/services/subscription';

interface UseSubscriptionActionsOptions {
  currentTier?: SubscriptionTier;
  onChanged?: () => void | Promise<void>;
}

export const useSubscriptionActions = ({ currentTier = 'starter', onChanged }: UseSubscriptionActionsOptions = {}) => {
  const [processing, setProcessing] = useState(false);

  const isUpgrade = useCallback(
    (tier: SubscriptionTier) => TIER_ORDER.indexOf(tier) > TIER_ORDER.indexOf(currentTier),
    [currentTier],
  );

  const changePlan = useCallback(
    async (tier: SubscriptionTier, billing: BillingPeriod) => {
      setProcessing(true);
      try {
        const result = await changeSubscription(tier, billing);

        if (result?.requiresPayment && result.paymentUrl && result.formData) {
          toast.info('Redirecting to secure checkout…');
          redirectToPayFast(result.paymentUrl, result.formData);
          return { redirected: true };
        }

        toast.success(
          isUpgrade(tier)
            ? `You're now on the ${tier.toUpperCase()} plan.`
            : `Plan changed to ${tier.toUpperCase()}. Changes take effect immediately.`,
        );
        await onChanged?.();
        return { redirected: false };
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to change plan');
        throw err;
      } finally {
        setProcessing(false);
      }
    },
    [isUpgrade, onChanged],
  );

  const cancelPlan = useCallback(
    async (reason?: string) => {
      setProcessing(true);
      try {
        await cancelSubscription(reason);
        toast.success('Subscription cancelled. You keep access until the period ends.');
        await onChanged?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to cancel subscription');
        throw err;
      } finally {
        setProcessing(false);
      }
    },
    [onChanged],
  );

  return { processing, changePlan, cancelPlan, isUpgrade };
};
