-- Admin › System Settings › Danger Zone calls reset_demo_data() as the signed-in admin.
-- Two security passes (20260717082904, 20260727231444) revoked EXECUTE on it from
-- `authenticated` along with other SECURITY DEFINER functions, which left the button
-- failing with "permission denied for function reset_demo_data".
--
-- The function checks the caller itself: it raises not_authenticated without a session
-- and not_authorized unless the caller has the admin role in user_roles. Granting
-- EXECUTE back to signed-in users therefore lets admins use it and nobody else.
--
-- WARNING: this function permanently deletes every row in the selected scopes
-- (orders, auctions and/or products with their stores). It is not limited to demo
-- rows. Only apply this migration if the Danger Zone is meant to work on this database.

REVOKE ALL ON FUNCTION public.reset_demo_data(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_demo_data(text[]) TO authenticated;
