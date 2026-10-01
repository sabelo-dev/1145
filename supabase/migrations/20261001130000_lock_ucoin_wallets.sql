-- UCoin wallets are server-controlled.
--
-- Since 20260101010036 the policy "Users can update their own wallet" let any
-- signed-in user set their own balance from the browser (and insert their own
-- "earn" transactions). Checkout redeems balances at R0.10 per UC
-- (redeem_ucoin_for_order), so that was spendable money.
--
-- Balances now only change through server functions (rewards engine,
-- checkout redemption, transfers), which run as SECURITY DEFINER.

DROP POLICY IF EXISTS "Users can update their own wallet" ON public.ucoin_wallets;
DROP POLICY IF EXISTS "Users can insert their own wallet" ON public.ucoin_wallets;
DROP POLICY IF EXISTS "System can insert transactions" ON public.ucoin_transactions;

-- Users may still create their own empty wallet on first visit.
DROP POLICY IF EXISTS "Users can create their empty wallet" ON public.ucoin_wallets;
CREATE POLICY "Users can create their empty wallet" ON public.ucoin_wallets
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND COALESCE(balance, 0) = 0
    AND COALESCE(lifetime_earned, 0) = 0
    AND COALESCE(lifetime_spent, 0) = 0
  );

-- Belt and braces: even if a permissive policy is added later, direct API
-- writes cannot move money. Server functions run as the function owner and
-- are unaffected; admins keep full access.
CREATE OR REPLACE FUNCTION public.guard_ucoin_wallet_client_writes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.balance := 0;
    NEW.lifetime_earned := 0;
    NEW.lifetime_spent := 0;
  ELSE
    NEW.user_id := OLD.user_id;
    NEW.balance := OLD.balance;
    NEW.lifetime_earned := OLD.lifetime_earned;
    NEW.lifetime_spent := OLD.lifetime_spent;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_ucoin_wallet_client_writes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_ucoin_wallet_client_writes ON public.ucoin_wallets;
CREATE TRIGGER trg_guard_ucoin_wallet_client_writes
  BEFORE INSERT OR UPDATE ON public.ucoin_wallets
  FOR EACH ROW EXECUTE FUNCTION public.guard_ucoin_wallet_client_writes();
