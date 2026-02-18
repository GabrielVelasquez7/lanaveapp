
-- Enable RLS on weekly_system_totals
ALTER TABLE public.weekly_system_totals ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "Admin users can manage all weekly system totals"
ON public.weekly_system_totals
FOR ALL
USING (public.has_role(auth.uid(), 'administrador'::user_role))
WITH CHECK (public.has_role(auth.uid(), 'administrador'::user_role));

-- Encargadas can manage (they use the weekly cuadre feature too)
CREATE POLICY "Encargadas can manage all weekly system totals"
ON public.weekly_system_totals
FOR ALL
USING (public.has_role(auth.uid(), 'encargada'::user_role))
WITH CHECK (public.has_role(auth.uid(), 'encargada'::user_role));
