-- merchant-subscription inserts payment_method 'payfast' and payfast-itn sets
-- status 'cancelled', but the original CHECK constraints allowed neither, so
-- PayFast plan upgrades failed on insert. Widen both to a superset.
ALTER TABLE public.subscription_payments
  DROP CONSTRAINT IF EXISTS subscription_payments_payment_method_check;
ALTER TABLE public.subscription_payments
  ADD CONSTRAINT subscription_payments_payment_method_check
  CHECK (payment_method IN ('platform_balance', 'payfast_debit', 'manual_card', 'payfast'));

ALTER TABLE public.subscription_payments
  DROP CONSTRAINT IF EXISTS subscription_payments_status_check;
ALTER TABLE public.subscription_payments
  ADD CONSTRAINT subscription_payments_status_check
  CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'cancelled'));
