-- Enable REPLICA IDENTITY FULL for complete row data during updates
ALTER TABLE public.auction_bids REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_bids;

-- Also enable realtime for auctions table to track status changes
ALTER TABLE public.auctions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.auctions;