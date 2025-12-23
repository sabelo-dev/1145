-- Create auction_watchlist table
CREATE TABLE public.auction_watchlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notify_on_bid BOOLEAN DEFAULT true,
  notify_on_ending BOOLEAN DEFAULT true,
  UNIQUE(user_id, auction_id)
);

-- Enable RLS
ALTER TABLE public.auction_watchlist ENABLE ROW LEVEL SECURITY;

-- Users can view their own watchlist
CREATE POLICY "Users can view their own watchlist"
ON public.auction_watchlist
FOR SELECT
USING (auth.uid() = user_id);

-- Users can add to their own watchlist
CREATE POLICY "Users can add to their own watchlist"
ON public.auction_watchlist
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own watchlist items
CREATE POLICY "Users can update their own watchlist"
ON public.auction_watchlist
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete from their own watchlist
CREATE POLICY "Users can delete from their own watchlist"
ON public.auction_watchlist
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_auction_watchlist_user_id ON public.auction_watchlist(user_id);
CREATE INDEX idx_auction_watchlist_auction_id ON public.auction_watchlist(auction_id);