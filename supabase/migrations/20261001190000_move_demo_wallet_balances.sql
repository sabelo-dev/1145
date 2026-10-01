-- Move the Rand balances of the old browser-written wallet (platform_wallets)
-- into the real wallet (public.wallets + public.wallet_ledger).
--
-- IMPORTANT: these balances were never checked against a payment. Until
-- 20261001180000_lock_demo_wallet.sql was applied, a member could set their
-- own balance. Moving them makes the money spendable and withdrawable, so
-- look at what will move first:
--
--   select w.user_id, u.email, w.balance_zar
--     from public.platform_wallets w join auth.users u on u.id = w.user_id
--    where w.balance_zar > 0 order by w.balance_zar desc;
--
-- Set any balance you do not accept to 0 before running this.
--
-- Each wallet is moved once: the ledger entry is an 'adjustment' with
-- provider 'platform_wallet' and the old wallet's id as reference, and the
-- old balance is set to 0. Gold balances are not moved.

DO $$
DECLARE
  r record;
  v_moved integer := 0;
  v_total numeric := 0;
BEGIN
  -- The old wallet must be locked first, or balances could be changed again.
  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'platform_wallets'
       AND policyname IN ('Users can update own wallet', 'Users can create own wallet')
  ) THEN
    RAISE EXCEPTION 'Run 20261001180000_lock_demo_wallet.sql before moving balances';
  END IF;

  FOR r IN
    SELECT w.id, w.user_id, w.balance_zar
      FROM public.platform_wallets w
     WHERE w.balance_zar > 0
       AND NOT EXISTS (
         SELECT 1 FROM public.wallet_ledger l
          WHERE l.provider = 'platform_wallet' AND l.provider_reference = w.id::text
       )
     ORDER BY w.created_at
     FOR UPDATE
  LOOP
    PERFORM public.credit_wallet(
      r.user_id, 'available', r.balance_zar, 'adjustment',
      'platform_wallet', r.id::text, 'platform_wallet', r.id::text,
      jsonb_build_object('note', 'Balance moved from the old wallet')
    );
    UPDATE public.platform_wallets SET balance_zar = 0 WHERE id = r.id;
    v_moved := v_moved + 1;
    v_total := v_total + r.balance_zar;
  END LOOP;

  RAISE NOTICE 'Moved % wallet balance(s), R% in total', v_moved, v_total;
END $$;
