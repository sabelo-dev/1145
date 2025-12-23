-- Add bid_increment column to auctions table
ALTER TABLE public.auctions
ADD COLUMN bid_increment numeric DEFAULT 50;