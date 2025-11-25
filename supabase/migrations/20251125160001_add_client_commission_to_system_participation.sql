-- Add client commission fields to client_system_participation table
ALTER TABLE public.client_system_participation
ADD COLUMN IF NOT EXISTS client_commission_percentage_bs NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (client_commission_percentage_bs >= 0 AND client_commission_percentage_bs <= 100),
ADD COLUMN IF NOT EXISTS client_commission_percentage_usd NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (client_commission_percentage_usd >= 0 AND client_commission_percentage_usd <= 100);

-- Remove commission fields from client_banqueo_commissions (keep only lanave participation)
ALTER TABLE public.client_banqueo_commissions
DROP COLUMN IF EXISTS commission_percentage_bs,
DROP COLUMN IF EXISTS commission_percentage_usd;

-- Update comments
COMMENT ON COLUMN public.client_system_participation.client_commission_percentage_bs IS 'Comisión del cliente en Bolívares (puede variar por sistema)';
COMMENT ON COLUMN public.client_system_participation.client_commission_percentage_usd IS 'Comisión del cliente en Dólares (puede variar por sistema)';
COMMENT ON COLUMN public.client_system_participation.participation_percentage_bs IS 'Participación del cliente en Bolívares (puede variar por sistema)';
COMMENT ON COLUMN public.client_system_participation.participation_percentage_usd IS 'Participación del cliente en Dólares (puede variar por sistema)';

COMMENT ON TABLE public.client_banqueo_commissions IS 'Almacena únicamente la participación de Lanave (única por cliente, aplica a todos los sistemas)';
COMMENT ON TABLE public.client_system_participation IS 'Almacena la comisión del cliente y su participación por sistema de lotería (puede variar por sistema)';

