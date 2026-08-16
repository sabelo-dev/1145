GRANT EXECUTE ON FUNCTION public.is_vendor_owned_path(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_product_image(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;