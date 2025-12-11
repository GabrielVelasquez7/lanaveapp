-- Update any existing user_roles with 'encargado' to 'encargada'
UPDATE public.user_roles 
SET role = 'encargada'::user_role 
WHERE role = 'encargado'::user_role;

-- Update any existing profiles with 'encargado' to 'encargada'
UPDATE public.profiles 
SET role = 'encargada'::user_role 
WHERE role = 'encargado'::user_role;