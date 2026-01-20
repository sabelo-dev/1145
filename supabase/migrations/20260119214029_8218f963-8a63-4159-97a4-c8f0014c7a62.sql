-- Update the existing profile to be admin
UPDATE public.profiles SET role = 'admin', name = 'Admin' WHERE email = 'admin@1145lifestyle.com';

-- Add admin role if not exists
INSERT INTO public.user_roles (user_id, role, created_at)
SELECT id, 'admin', NOW() FROM auth.users WHERE email = 'admin@1145lifestyle.com'
ON CONFLICT DO NOTHING;