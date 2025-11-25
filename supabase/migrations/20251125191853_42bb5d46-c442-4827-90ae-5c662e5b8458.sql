-- Create banqueo commission configuration table
CREATE TABLE IF NOT EXISTS public.banqueo_commission_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_commission_percentage NUMERIC NOT NULL DEFAULT 0,
  lanave_commission_percentage NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT venezuela_now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT venezuela_now()
);

-- Enable RLS
ALTER TABLE public.banqueo_commission_config ENABLE ROW LEVEL SECURITY;

-- Admin users can manage banqueo commission config
CREATE POLICY "Admin users can manage banqueo commission config"
  ON public.banqueo_commission_config
  FOR ALL
  USING (has_role(auth.uid(), 'administrador'::user_role))
  WITH CHECK (has_role(auth.uid(), 'administrador'::user_role));

-- Encargadas can view banqueo commission config
CREATE POLICY "Encargadas can view banqueo commission config"
  ON public.banqueo_commission_config
  FOR SELECT
  USING (has_role(auth.uid(), 'encargada'::user_role));

-- Insert default configuration
INSERT INTO public.banqueo_commission_config (client_commission_percentage, lanave_commission_percentage)
VALUES (0, 0)
ON CONFLICT DO NOTHING;