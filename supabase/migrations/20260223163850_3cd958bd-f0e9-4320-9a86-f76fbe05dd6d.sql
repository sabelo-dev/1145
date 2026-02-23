
-- Add admin response columns to support_tickets
ALTER TABLE public.support_tickets 
ADD COLUMN IF NOT EXISTS admin_response TEXT,
ADD COLUMN IF NOT EXISTS responded_by UUID,
ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;

-- Ensure admins can INSERT notifications for any user (for announcements)
-- The existing policy allows any authenticated user to insert, which is fine for admin use
