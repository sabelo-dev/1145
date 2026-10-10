-- New user role: restaurateur (someone who runs an eatery).
--
-- A new enum value cannot be used in the transaction that adds it, so the
-- triggers and backfill that use it are in the next migration. Run this file
-- on its own first.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'restaurateur';
