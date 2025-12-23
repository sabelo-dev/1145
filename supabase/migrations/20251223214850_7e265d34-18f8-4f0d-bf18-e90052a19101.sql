-- Create table for storing proxy/auto bids
CREATE TABLE public.proxy_bids (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  max_amount NUMERIC NOT NULL CHECK (max_amount > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(auction_id, user_id)
);

-- Enable RLS
ALTER TABLE public.proxy_bids ENABLE ROW LEVEL SECURITY;

-- Users can view their own proxy bids
CREATE POLICY "Users can view their own proxy bids"
ON public.proxy_bids
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own proxy bids
CREATE POLICY "Users can create their own proxy bids"
ON public.proxy_bids
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own proxy bids
CREATE POLICY "Users can update their own proxy bids"
ON public.proxy_bids
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own proxy bids
CREATE POLICY "Users can delete their own proxy bids"
ON public.proxy_bids
FOR DELETE
USING (auth.uid() = user_id);

-- Create function to process proxy bids when a new bid is placed
CREATE OR REPLACE FUNCTION public.process_proxy_bids()
RETURNS TRIGGER AS $$
DECLARE
  auction_record RECORD;
  proxy_record RECORD;
  new_bid_amount NUMERIC;
  bid_increment NUMERIC;
BEGIN
  -- Get auction details
  SELECT * INTO auction_record FROM public.auctions WHERE id = NEW.auction_id;
  
  IF NOT FOUND OR auction_record.status != 'active' THEN
    RETURN NEW;
  END IF;
  
  bid_increment := COALESCE(auction_record.bid_increment, 10);
  
  -- Find all active proxy bids for this auction that can outbid the current bid
  -- Exclude the user who just placed the bid
  FOR proxy_record IN 
    SELECT * FROM public.proxy_bids 
    WHERE auction_id = NEW.auction_id 
      AND is_active = true 
      AND user_id != NEW.user_id
      AND max_amount > NEW.bid_amount
    ORDER BY max_amount DESC, created_at ASC
    LIMIT 1
  LOOP
    -- Calculate the new bid amount (minimum to outbid + increment, but not exceeding max)
    new_bid_amount := LEAST(
      proxy_record.max_amount,
      NEW.bid_amount + bid_increment
    );
    
    -- Only place bid if it's higher than current bid
    IF new_bid_amount > NEW.bid_amount THEN
      -- Insert the automatic bid
      INSERT INTO public.auction_bids (auction_id, user_id, bid_amount)
      VALUES (NEW.auction_id, proxy_record.user_id, new_bid_amount);
      
      -- Update auction current bid
      UPDATE public.auctions 
      SET current_bid = new_bid_amount, updated_at = now()
      WHERE id = NEW.auction_id;
      
      -- If proxy bid is now at max, deactivate it
      IF new_bid_amount >= proxy_record.max_amount THEN
        UPDATE public.proxy_bids 
        SET is_active = false, updated_at = now()
        WHERE id = proxy_record.id;
      END IF;
    END IF;
    
    EXIT; -- Only process the highest proxy bid
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to process proxy bids after a new bid is inserted
CREATE TRIGGER trigger_process_proxy_bids
AFTER INSERT ON public.auction_bids
FOR EACH ROW
EXECUTE FUNCTION public.process_proxy_bids();

-- Update timestamp trigger for proxy_bids
CREATE TRIGGER update_proxy_bids_updated_at
BEFORE UPDATE ON public.proxy_bids
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();