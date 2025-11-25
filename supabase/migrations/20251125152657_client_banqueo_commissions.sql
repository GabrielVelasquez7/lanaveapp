-- Create table for client-specific banqueo commissions
CREATE TABLE IF NOT EXISTS public.client_banqueo_commissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  lanave_participation_percentage_bs NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (lanave_participation_percentage_bs >= 0 AND lanave_participation_percentage_bs <= 100),
  lanave_participation_percentage_usd NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (lanave_participation_percentage_usd >= 0 AND lanave_participation_percentage_usd <= 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT venezuela_now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT venezuela_now(),
  UNIQUE(client_id)
);

-- Create table for client-specific participation by lottery system
CREATE TABLE IF NOT EXISTS public.client_system_participation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  lottery_system_id UUID NOT NULL REFERENCES public.lottery_systems(id) ON DELETE CASCADE,
  client_commission_percentage_bs NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (client_commission_percentage_bs >= 0 AND client_commission_percentage_bs <= 100),
  client_commission_percentage_usd NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (client_commission_percentage_usd >= 0 AND client_commission_percentage_usd <= 100),
  participation_percentage_bs NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (participation_percentage_bs >= 0 AND participation_percentage_bs <= 100),
  participation_percentage_usd NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (participation_percentage_usd >= 0 AND participation_percentage_usd <= 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT venezuela_now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT venezuela_now(),
  UNIQUE(client_id, lottery_system_id)
);

-- Create indexes for faster lookups
CREATE INDEX idx_client_banqueo_commissions_client ON public.client_banqueo_commissions(client_id);
CREATE INDEX idx_client_banqueo_commissions_active ON public.client_banqueo_commissions(is_active);
CREATE INDEX idx_client_system_participation_client ON public.client_system_participation(client_id);
CREATE INDEX idx_client_system_participation_system ON public.client_system_participation(lottery_system_id);
CREATE INDEX idx_client_system_participation_active ON public.client_system_participation(is_active);

-- Enable RLS
ALTER TABLE public.client_banqueo_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_system_participation ENABLE ROW LEVEL SECURITY;

-- RLS Policies for client_banqueo_commissions
CREATE POLICY "Admin users can manage client banqueo commissions"
  ON public.client_banqueo_commissions
  FOR ALL
  USING (has_role(auth.uid(), 'administrador'::user_role))
  WITH CHECK (has_role(auth.uid(), 'administrador'::user_role));

CREATE POLICY "Encargadas can view client banqueo commissions"
  ON public.client_banqueo_commissions
  FOR SELECT
  USING (has_role(auth.uid(), 'encargada'::user_role));

-- RLS Policies for client_system_participation
CREATE POLICY "Admin users can manage client system participation"
  ON public.client_system_participation
  FOR ALL
  USING (has_role(auth.uid(), 'administrador'::user_role))
  WITH CHECK (has_role(auth.uid(), 'administrador'::user_role));

CREATE POLICY "Encargadas can view client system participation"
  ON public.client_system_participation
  FOR SELECT
  USING (has_role(auth.uid(), 'encargada'::user_role));

-- Create triggers for updated_at
CREATE TRIGGER update_client_banqueo_commissions_updated_at
BEFORE UPDATE ON public.client_banqueo_commissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column_venezuela();

CREATE TRIGGER update_client_system_participation_updated_at
BEFORE UPDATE ON public.client_system_participation
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column_venezuela();

-- Comments
COMMENT ON TABLE public.client_banqueo_commissions IS 'Almacena únicamente la participación de Lanave (única por cliente, aplica a todos los sistemas)';
COMMENT ON TABLE public.client_system_participation IS 'Almacena la comisión del cliente y su participación por sistema de lotería (puede variar por sistema)';
COMMENT ON COLUMN public.client_system_participation.client_commission_percentage_bs IS 'Comisión del cliente en Bolívares (puede variar por sistema)';
COMMENT ON COLUMN public.client_system_participation.client_commission_percentage_usd IS 'Comisión del cliente en Dólares (puede variar por sistema)';
COMMENT ON COLUMN public.client_system_participation.participation_percentage_bs IS 'Participación del cliente en Bolívares (puede variar por sistema)';
COMMENT ON COLUMN public.client_system_participation.participation_percentage_usd IS 'Participación del cliente en Dólares (puede variar por sistema)';

