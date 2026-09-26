
CREATE TABLE public.ucoin_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  category text,
  condition text NOT NULL DEFAULT 'used',
  price_ucoin integer NOT NULL CHECK (price_ucoin > 0),
  allow_bids boolean NOT NULL DEFAULT false,
  starting_bid_ucoin integer,
  highest_bid_ucoin integer,
  highest_bidder_id uuid,
  location text,
  status text NOT NULL DEFAULT 'active',
  buyer_id uuid,
  sold_price_ucoin integer,
  sold_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ucoin_listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ucoin_listings TO authenticated;
GRANT ALL ON public.ucoin_listings TO service_role;
ALTER TABLE public.ucoin_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active listings" ON public.ucoin_listings
FOR SELECT USING (status = 'active' OR seller_id = auth.uid() OR buyer_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users create own listings" ON public.ucoin_listings
FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Sellers update own listings" ON public.ucoin_listings
FOR UPDATE TO authenticated USING (seller_id = auth.uid() OR public.is_admin())
WITH CHECK (seller_id = auth.uid() OR public.is_admin());

CREATE POLICY "Sellers delete own listings" ON public.ucoin_listings
FOR DELETE TO authenticated USING (seller_id = auth.uid() OR public.is_admin());

CREATE INDEX idx_ucoin_listings_status ON public.ucoin_listings(status, created_at DESC);
CREATE INDEX idx_ucoin_listings_seller ON public.ucoin_listings(seller_id);

CREATE TRIGGER update_ucoin_listings_updated_at
BEFORE UPDATE ON public.ucoin_listings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ucoin_listing_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.ucoin_listings(id) ON DELETE CASCADE,
  bidder_id uuid NOT NULL,
  amount_ucoin integer NOT NULL CHECK (amount_ucoin > 0),
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.ucoin_listing_bids TO authenticated;
GRANT ALL ON public.ucoin_listing_bids TO service_role;
ALTER TABLE public.ucoin_listing_bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bidders and sellers view bids" ON public.ucoin_listing_bids
FOR SELECT TO authenticated USING (
  bidder_id = auth.uid()
  OR public.is_admin()
  OR EXISTS (SELECT 1 FROM public.ucoin_listings l WHERE l.id = listing_id AND l.seller_id = auth.uid())
);

CREATE POLICY "Users place own bids" ON public.ucoin_listing_bids
FOR INSERT TO authenticated WITH CHECK (bidder_id = auth.uid());

CREATE POLICY "Bidders and sellers update bids" ON public.ucoin_listing_bids
FOR UPDATE TO authenticated USING (
  bidder_id = auth.uid()
  OR public.is_admin()
  OR EXISTS (SELECT 1 FROM public.ucoin_listings l WHERE l.id = listing_id AND l.seller_id = auth.uid())
);

CREATE INDEX idx_ucoin_listing_bids_listing ON public.ucoin_listing_bids(listing_id, amount_ucoin DESC);

CREATE TRIGGER update_ucoin_listing_bids_updated_at
BEFORE UPDATE ON public.ucoin_listing_bids
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ucoin_cashouts ADD COLUMN IF NOT EXISTS bank_account_id uuid;

-- Move UCoin from buyer to seller and complete a listing sale
CREATE OR REPLACE FUNCTION public.settle_ucoin_listing(p_listing_id uuid, p_buyer_id uuid, p_amount integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing public.ucoin_listings%ROWTYPE;
  v_balance numeric;
BEGIN
  SELECT * INTO v_listing FROM public.ucoin_listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Listing not found'); END IF;
  IF v_listing.status <> 'active' THEN RETURN jsonb_build_object('success', false, 'error', 'This item is no longer available'); END IF;
  IF v_listing.seller_id = p_buyer_id THEN RETURN jsonb_build_object('success', false, 'error', 'You cannot buy your own item'); END IF;

  SELECT balance INTO v_balance FROM public.ucoin_wallets WHERE user_id = p_buyer_id FOR UPDATE;
  IF v_balance IS NULL OR v_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not enough UCoin');
  END IF;

  UPDATE public.ucoin_wallets
    SET balance = balance - p_amount,
        lifetime_spent = COALESCE(lifetime_spent, 0) + p_amount,
        updated_at = now()
  WHERE user_id = p_buyer_id;

  INSERT INTO public.ucoin_wallets (user_id, balance, lifetime_earned)
  VALUES (v_listing.seller_id, p_amount, p_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.ucoin_wallets.balance + p_amount,
        lifetime_earned = COALESCE(public.ucoin_wallets.lifetime_earned, 0) + p_amount,
        updated_at = now();

  INSERT INTO public.ucoin_transactions (user_id, amount, type, category, description, reference_id, reference_type, sender_id, recipient_id)
  VALUES
    (p_buyer_id, -p_amount, 'spend', 'marketplace', 'Bought: ' || v_listing.title, p_listing_id, 'ucoin_listing', p_buyer_id, v_listing.seller_id),
    (v_listing.seller_id, p_amount, 'earn', 'marketplace', 'Sold: ' || v_listing.title, p_listing_id, 'ucoin_listing', p_buyer_id, v_listing.seller_id);

  UPDATE public.ucoin_listings
    SET status = 'sold', buyer_id = p_buyer_id, sold_price_ucoin = p_amount, sold_at = now(), updated_at = now()
  WHERE id = p_listing_id;

  UPDATE public.ucoin_listing_bids SET status = 'closed', updated_at = now()
  WHERE listing_id = p_listing_id AND status = 'active';

  RETURN jsonb_build_object('success', true, 'listing_id', p_listing_id, 'amount', p_amount);
END;
$$;

CREATE OR REPLACE FUNCTION public.buy_ucoin_listing(p_listing_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_price integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Please sign in'); END IF;
  SELECT price_ucoin INTO v_price FROM public.ucoin_listings WHERE id = p_listing_id;
  IF v_price IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Listing not found'); END IF;
  RETURN public.settle_ucoin_listing(p_listing_id, auth.uid(), v_price);
END;
$$;

CREATE OR REPLACE FUNCTION public.place_ucoin_bid(p_listing_id uuid, p_amount integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing public.ucoin_listings%ROWTYPE;
  v_balance numeric;
  v_min integer;
  v_bid_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Please sign in'); END IF;

  SELECT * INTO v_listing FROM public.ucoin_listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND OR v_listing.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This item is no longer available');
  END IF;
  IF NOT v_listing.allow_bids THEN
    RETURN jsonb_build_object('success', false, 'error', 'This seller is not accepting offers');
  END IF;
  IF v_listing.seller_id = auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot bid on your own item');
  END IF;

  v_min := GREATEST(COALESCE(v_listing.highest_bid_ucoin, 0) + 1, COALESCE(v_listing.starting_bid_ucoin, 1));
  IF p_amount < v_min THEN
    RETURN jsonb_build_object('success', false, 'error', 'Your offer must be at least ' || v_min || ' UCoin');
  END IF;

  SELECT balance INTO v_balance FROM public.ucoin_wallets WHERE user_id = auth.uid();
  IF v_balance IS NULL OR v_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not enough UCoin to cover this offer');
  END IF;

  INSERT INTO public.ucoin_listing_bids (listing_id, bidder_id, amount_ucoin)
  VALUES (p_listing_id, auth.uid(), p_amount)
  RETURNING id INTO v_bid_id;

  UPDATE public.ucoin_listings
    SET highest_bid_ucoin = p_amount, highest_bidder_id = auth.uid(), updated_at = now()
  WHERE id = p_listing_id;

  RETURN jsonb_build_object('success', true, 'bid_id', v_bid_id, 'amount', p_amount);
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_ucoin_bid(p_bid_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bid public.ucoin_listing_bids%ROWTYPE;
  v_seller uuid;
  v_result jsonb;
BEGIN
  SELECT * INTO v_bid FROM public.ucoin_listing_bids WHERE id = p_bid_id;
  IF NOT FOUND OR v_bid.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Offer not available');
  END IF;

  SELECT seller_id INTO v_seller FROM public.ucoin_listings WHERE id = v_bid.listing_id;
  IF v_seller IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the seller can accept an offer');
  END IF;

  v_result := public.settle_ucoin_listing(v_bid.listing_id, v_bid.bidder_id, v_bid.amount_ucoin);
  IF (v_result->>'success')::boolean THEN
    UPDATE public.ucoin_listing_bids SET status = 'accepted', updated_at = now() WHERE id = p_bid_id;
  END IF;
  RETURN v_result;
END;
$$;
