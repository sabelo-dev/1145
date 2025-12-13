-- Drop driver-related tables
DROP TABLE IF EXISTS driver_payouts CASCADE;
DROP TABLE IF EXISTS driver_analytics CASCADE;
DROP TABLE IF EXISTS delivery_jobs CASCADE;
DROP TABLE IF EXISTS drivers CASCADE;

-- Remove 'driver' from app_role enum
-- First, update any profiles that have 'driver' role to 'consumer'
UPDATE profiles SET role = 'consumer' WHERE role = 'driver';

-- Delete driver role entries from user_roles
DELETE FROM user_roles WHERE role = 'driver';

-- Note: Altering enum types to remove values is complex in PostgreSQL
-- The 'driver' value will remain in the enum but won't be used