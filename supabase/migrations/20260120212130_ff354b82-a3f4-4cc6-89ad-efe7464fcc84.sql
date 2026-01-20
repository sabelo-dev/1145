-- Create table to store inbound emails received via Resend webhook
CREATE TABLE public.inbound_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_address TEXT NOT NULL,
  to_addresses TEXT[] NOT NULL,
  subject TEXT NOT NULL DEFAULT '(No Subject)',
  body_text TEXT,
  body_html TEXT,
  has_attachments BOOLEAN DEFAULT false,
  attachment_count INTEGER DEFAULT 0,
  raw_payload JSONB,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_read BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.inbound_emails ENABLE ROW LEVEL SECURITY;

-- Only admins can view inbound emails
CREATE POLICY "Admins can view inbound emails"
ON public.inbound_emails
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Only admins can update inbound emails (mark as read, archive, etc.)
CREATE POLICY "Admins can update inbound emails"
ON public.inbound_emails
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Create index for faster queries
CREATE INDEX idx_inbound_emails_received_at ON public.inbound_emails(received_at DESC);
CREATE INDEX idx_inbound_emails_from ON public.inbound_emails(from_address);
CREATE INDEX idx_inbound_emails_is_read ON public.inbound_emails(is_read) WHERE is_read = false;