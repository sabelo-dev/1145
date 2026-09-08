
CREATE OR REPLACE FUNCTION public.mining_credit_request(p_request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.mining_requests;
  v_balance numeric;
BEGIN
  SELECT * INTO v_req FROM public.mining_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_req.status = 'credited' THEN RETURN true; END IF;
  IF v_req.status <> 'approved' THEN
    RAISE EXCEPTION 'Cannot credit request not in approved state (status=%)', v_req.status;
  END IF;

  SELECT COALESCE(SUM(delta_mg),0) INTO v_balance
    FROM public.ucoin_ledger WHERE user_id = v_req.user_id;

  INSERT INTO public.ucoin_ledger(user_id, request_id, delta_mg, kind, reason, running_balance)
  VALUES (v_req.user_id, v_req.id, v_req.reward_mg, 'credit', v_req.activity_code, v_balance + v_req.reward_mg);

  INSERT INTO public.ucoin_wallets(user_id, balance, lifetime_earned, lifetime_spent)
  VALUES (v_req.user_id, v_req.reward_mg, v_req.reward_mg, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = ucoin_wallets.balance + EXCLUDED.balance,
        lifetime_earned = ucoin_wallets.lifetime_earned + EXCLUDED.balance,
        updated_at = now();

  INSERT INTO public.ucoin_transactions(user_id, amount, type, category, description, reference_id, reference_type)
  VALUES (v_req.user_id, v_req.reward_mg::integer, 'earn', 'social_mining',
    'Mining reward: ' || v_req.activity_code, v_req.id, 'mining_request');

  UPDATE public.mining_requests
    SET status = 'credited', credited_at = now(), updated_at = now()
    WHERE id = p_request_id;

  INSERT INTO public.mining_events(request_id, stage, actor, payload)
  VALUES (p_request_id, 'credited', 'system',
    jsonb_build_object('amount_mg', v_req.reward_mg));

  INSERT INTO public.user_notifications(user_id, type, title, message, data)
  VALUES (v_req.user_id, 'ucoin_credit',
    'You earned ' || v_req.reward_mg || ' UCoin',
    'Reward for: ' || v_req.activity_code,
    jsonb_build_object('request_id', v_req.id, 'activity', v_req.activity_code));

  RETURN true;
END;
$$;
