-- Drop the existing INSERT policy for auction_bids
DROP POLICY IF EXISTS "Registered users can place bids" ON public.auction_bids;

-- Create a security definer function to check if user is registered and paid for an auction
CREATE OR REPLACE FUNCTION public.is_registered_for_auction(_user_id uuid, _auction_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.auction_registrations
    WHERE auction_id = _auction_id
      AND user_id = _user_id
      AND payment_status = 'paid'
  )
$$;

-- Create a security definer function to check if auction is active
CREATE OR REPLACE FUNCTION public.is_auction_active(_auction_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.auctions
    WHERE id = _auction_id
      AND status = 'active'
  )
$$;

-- Recreate the INSERT policy using security definer functions
CREATE POLICY "Registered users can place bids"
ON public.auction_bids
FOR INSERT
WITH CHECK (
  user_id = auth.uid() 
  AND public.is_registered_for_auction(auth.uid(), auction_id)
  AND public.is_auction_active(auction_id)
);