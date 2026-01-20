-- Update the admin profile with name and phone
UPDATE public.profiles 
SET name = 'Sabelo', 
    phone = '0761597719',
    role = 'admin'
WHERE id = '46b1d839-0d5e-47e6-8dde-e4d289dfe96f';

-- Ensure admin role exists in user_roles table
INSERT INTO public.user_roles (user_id, role)
VALUES ('46b1d839-0d5e-47e6-8dde-e4d289dfe96f', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;