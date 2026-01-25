-- Create audit log table for vendor subscription changes
CREATE TABLE public.vendor_subscription_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL,
  change_type TEXT NOT NULL, -- 'tier_change', 'status_change', 'tier_and_status_change'
  old_tier TEXT,
  new_tier TEXT,
  old_status TEXT,
  new_status TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vendor_subscription_audit_log ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access (admins can view/insert audit logs)
CREATE POLICY "Admins can manage subscription audit logs"
ON public.vendor_subscription_audit_log
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create policy for vendors to view their own audit logs
CREATE POLICY "Vendors can view their own subscription audit logs"
ON public.vendor_subscription_audit_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = vendor_subscription_audit_log.vendor_id
    AND v.user_id = auth.uid()
  )
);

-- Create index for faster queries
CREATE INDEX idx_vendor_subscription_audit_log_vendor_id ON public.vendor_subscription_audit_log(vendor_id);
CREATE INDEX idx_vendor_subscription_audit_log_created_at ON public.vendor_subscription_audit_log(created_at DESC);