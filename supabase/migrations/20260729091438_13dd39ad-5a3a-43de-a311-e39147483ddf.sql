
REVOKE EXECUTE ON FUNCTION public.credit_wallet(uuid,public.wallet_bucket,numeric,public.ledger_type,text,text,text,text,jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.debit_wallet(uuid,public.wallet_bucket,numeric,public.ledger_type,text,text,text,text,jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_or_create_1145_wallet(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_wallet_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_wallet_summary(uuid) TO authenticated;
