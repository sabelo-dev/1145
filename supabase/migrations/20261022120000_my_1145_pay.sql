-- 1145 Pay for shoppers: their own payment history.
--
-- payer_user_id is set when a signed-in member pays (saved card or UCoin), and
-- from now on also when a signed-in member starts PayFast checkout (the
-- merchant-payment-request function records it while the request is still
-- pending; payment_request_settle keeps it).

CREATE OR REPLACE FUNCTION public.my_1145_pay_payments(p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(p ORDER BY p.paid_at DESC), '[]'::jsonb)
    FROM (
      SELECT r.public_token AS token, s.name AS store_name, s.logo_url AS store_logo_url,
             r.description, r.amount_minor, r.currency, r.paid_with, r.paid_at, r.status
        FROM public.merchant_payment_requests r
        JOIN public.stores s ON s.id = r.store_id
       WHERE r.payer_user_id = auth.uid()
         AND r.status IN ('paid', 'refund_due')
       ORDER BY r.paid_at DESC
       LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100)
    ) p;
$function$;

REVOKE EXECUTE ON FUNCTION public.my_1145_pay_payments(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_1145_pay_payments(integer) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
