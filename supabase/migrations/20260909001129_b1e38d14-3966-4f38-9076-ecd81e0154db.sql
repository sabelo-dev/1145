
CREATE OR REPLACE FUNCTION public.request_ucoin_cashout_to_bank(p_ucoin integer, p_bank_account_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_balance integer;
  v_acct record;
  v_zar numeric;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'You must be signed in.');
  END IF;
  IF p_ucoin IS NULL OR p_ucoin < 500 THEN
    RETURN json_build_object('success', false, 'error', 'Minimum withdrawal is 500 UCoin.');
  END IF;

  SELECT * INTO v_acct FROM public.user_linked_bank_accounts
   WHERE id = p_bank_account_id AND user_id = v_user;
  IF v_acct IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'That bank account is not linked to your profile.');
  END IF;

  SELECT balance INTO v_balance FROM public.ucoin_wallets WHERE user_id = v_user FOR UPDATE;
  IF v_balance IS NULL OR v_balance < p_ucoin THEN
    RETURN json_build_object('success', false, 'error', 'Not enough UCoin in your wallet.');
  END IF;

  v_zar := round(p_ucoin * 0.10, 2);

  UPDATE public.ucoin_wallets
     SET balance = balance - p_ucoin,
         lifetime_spent = COALESCE(lifetime_spent, 0) + p_ucoin
   WHERE user_id = v_user;

  INSERT INTO public.ucoin_cashouts (user_id, ucoin_amount, zar_amount, status, destination, bank_account_id)
  VALUES (v_user, p_ucoin, v_zar, 'pending',
          COALESCE(v_acct.bank_name, 'Bank') || ' ' || COALESCE(v_acct.account_number_masked, ''),
          p_bank_account_id)
  RETURNING id INTO v_id;

  INSERT INTO public.ucoin_transactions (user_id, amount, type, category, description, reference_id, reference_type)
  VALUES (v_user, p_ucoin, 'spend', 'cashout', 'Withdrawal to bank account', v_id, 'ucoin_cashout');

  RETURN json_build_object('success', true, 'cashout_id', v_id, 'zar_amount', v_zar);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_ucoin_cashout_to_bank(integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_ucoin_cashout_to_bank(integer, uuid) TO authenticated;
