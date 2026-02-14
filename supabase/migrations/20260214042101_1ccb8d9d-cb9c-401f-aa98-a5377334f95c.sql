-- Add custom markup percentage column to vendors table
-- NULL means use the default platform markup (10%)
-- 0 means no platform fee (e.g., promotional/special case)
ALTER TABLE public.vendors
ADD COLUMN custom_markup_percentage numeric DEFAULT NULL;

-- Add a comment for clarity
COMMENT ON COLUMN public.vendors.custom_markup_percentage IS 'Custom platform markup percentage for this vendor. NULL = use default (10%). 0 = no fee.';
