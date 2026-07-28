CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role app_role;
BEGIN
  user_role := CASE NEW.raw_user_meta_data ->> 'role'
    WHEN 'admin' THEN 'admin'::app_role
    WHEN 'vendor' THEN 'vendor'::app_role
    WHEN 'driver' THEN 'driver'::app_role
    WHEN 'influencer' THEN 'influencer'::app_role
    ELSE 'consumer'::app_role
  END;

  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.raw_user_meta_data ->> 'full_name', ''),
    user_role
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;