-- Create auctions table
CREATE TABLE public.auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  vendor_base_amount NUMERIC NOT NULL,
  starting_bid_price NUMERIC,
  current_bid NUMERIC,
  registration_fee NUMERIC DEFAULT 0,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'active', 'ended', 'sold', 'unsold')),
  winner_id UUID,
  winning_bid NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create auction registrations table
CREATE TABLE public.auction_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  registration_fee_paid NUMERIC NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  is_winner BOOLEAN DEFAULT false,
  deposit_applied BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(auction_id, user_id)
);

-- Create auction bids table
CREATE TABLE public.auction_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  bid_amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_bids ENABLE ROW LEVEL SECURITY;

-- Auctions policies
CREATE POLICY "Anyone can view approved/active auctions" ON public.auctions
  FOR SELECT USING (status IN ('approved', 'active', 'ended', 'sold', 'unsold'));

CREATE POLICY "Vendors can view their own auctions" ON public.auctions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM products p
      JOIN stores s ON p.store_id = s.id
      JOIN vendors v ON s.vendor_id = v.id
      WHERE p.id = auctions.product_id AND v.user_id = auth.uid()
    )
  );

CREATE POLICY "Vendors can create auctions for their products" ON public.auctions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM products p
      JOIN stores s ON p.store_id = s.id
      JOIN vendors v ON s.vendor_id = v.id
      WHERE p.id = product_id AND v.user_id = auth.uid()
    )
  );

CREATE POLICY "Vendors can update their pending auctions" ON public.auctions
  FOR UPDATE USING (
    status = 'pending' AND EXISTS (
      SELECT 1 FROM products p
      JOIN stores s ON p.store_id = s.id
      JOIN vendors v ON s.vendor_id = v.id
      WHERE p.id = auctions.product_id AND v.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all auctions" ON public.auctions
  FOR ALL USING (is_admin());

-- Auction registrations policies
CREATE POLICY "Users can view their own registrations" ON public.auction_registrations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all registrations" ON public.auction_registrations
  FOR SELECT USING (is_admin());

CREATE POLICY "Vendors can view registrations for their auctions" ON public.auction_registrations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auctions a
      JOIN products p ON a.product_id = p.id
      JOIN stores s ON p.store_id = s.id
      JOIN vendors v ON s.vendor_id = v.id
      WHERE a.id = auction_registrations.auction_id AND v.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can register for auctions" ON public.auction_registrations
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage registrations" ON public.auction_registrations
  FOR ALL USING (is_admin());

-- Auction bids policies
CREATE POLICY "Anyone can view bids on active auctions" ON public.auction_bids
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM auctions WHERE id = auction_id AND status = 'active')
  );

CREATE POLICY "Registered users can place bids" ON public.auction_bids
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM auction_registrations 
      WHERE auction_id = auction_bids.auction_id 
      AND user_id = auth.uid() 
      AND payment_status = 'paid'
    )
  );

CREATE POLICY "Admins can manage bids" ON public.auction_bids
  FOR ALL USING (is_admin());

-- Trigger to update current_bid on new bid
CREATE OR REPLACE FUNCTION update_auction_current_bid()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auctions 
  SET current_bid = NEW.bid_amount, updated_at = now()
  WHERE id = NEW.auction_id AND (current_bid IS NULL OR current_bid < NEW.bid_amount);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_new_bid
  AFTER INSERT ON public.auction_bids
  FOR EACH ROW EXECUTE FUNCTION update_auction_current_bid();

-- Trigger for updated_at
CREATE TRIGGER update_auctions_updated_at
  BEFORE UPDATE ON public.auctions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();