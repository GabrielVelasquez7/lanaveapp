-- Drop the broken policy that uses auth.uid() = id (should be user_id)
DROP POLICY IF EXISTS "allow authenticated users to insert their own profile" ON public.profiles;

-- Create corrected policy that properly compares with user_id
CREATE POLICY "allow authenticated users to insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);