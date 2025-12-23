-- Create auction status history table
CREATE TABLE public.auction_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.auction_status_history ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX idx_auction_status_history_auction_id ON public.auction_status_history(auction_id);

-- Policy: Vendors can view history for their own auctions
CREATE POLICY "Vendors can view their auction status history"
ON public.auction_status_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.auctions a
    JOIN public.products p ON a.product_id = p.id
    JOIN public.stores s ON p.store_id = s.id
    JOIN public.vendors v ON s.vendor_id = v.id
    WHERE a.id = auction_status_history.auction_id
    AND v.user_id = auth.uid()
  )
);

-- Policy: Admins can view all history
CREATE POLICY "Admins can view all auction status history"
ON public.auction_status_history
FOR SELECT
USING (public.is_admin());

-- Policy: System can insert history records
CREATE POLICY "Authenticated users can insert auction status history"
ON public.auction_status_history
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Create function to automatically log status changes
CREATE OR REPLACE FUNCTION public.log_auction_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.auction_status_history (auction_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to log status changes automatically
CREATE TRIGGER auction_status_change_trigger
AFTER UPDATE ON public.auctions
FOR EACH ROW
EXECUTE FUNCTION public.log_auction_status_change();

-- Also log initial creation
CREATE OR REPLACE FUNCTION public.log_auction_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.auction_status_history (auction_id, old_status, new_status, changed_by, notes)
  VALUES (NEW.id, NULL, NEW.status, auth.uid(), 'Auction created');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER auction_creation_trigger
AFTER INSERT ON public.auctions
FOR EACH ROW
EXECUTE FUNCTION public.log_auction_creation();