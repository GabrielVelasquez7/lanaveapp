-- Add RLS policy for encargadas to manage all pending prizes (similar to expenses and debts)
CREATE POLICY "Encargadas can manage all pending prizes"
ON public.pending_prizes
FOR ALL
USING (has_role(auth.uid(), 'encargada'::user_role))
WITH CHECK (has_role(auth.uid(), 'encargada'::user_role));