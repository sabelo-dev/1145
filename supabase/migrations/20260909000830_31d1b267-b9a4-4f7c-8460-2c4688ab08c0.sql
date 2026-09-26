
REVOKE EXECUTE ON FUNCTION public.settle_ucoin_listing(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.buy_ucoin_listing(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.place_ucoin_bid(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_ucoin_bid(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_ucoin_listing(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_ucoin_bid(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_ucoin_bid(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_ucoin_listing(uuid, uuid, integer) TO service_role;
