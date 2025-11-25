-- Add lanave participation percentage fields to client_banqueo_commissions
ALTER TABLE public.client_banqueo_commissions
ADD COLUMN IF NOT EXISTS lanave_participation_percentage_bs NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (lanave_participation_percentage_bs >= 0 AND lanave_participation_percentage_bs <= 100),
ADD COLUMN IF NOT EXISTS lanave_participation_percentage_usd NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (lanave_participation_percentage_usd >= 0 AND lanave_participation_percentage_usd <= 100);

-- Update comment
COMMENT ON COLUMN public.client_banqueo_commissions.commission_percentage_bs IS 'Comisión que se le cobra al cliente en Bolívares';
COMMENT ON COLUMN public.client_banqueo_commissions.commission_percentage_usd IS 'Comisión que se le cobra al cliente en Dólares';
COMMENT ON COLUMN public.client_banqueo_commissions.lanave_participation_percentage_bs IS 'Participación de Lanave (única por cliente) en Bolívares';
COMMENT ON COLUMN public.client_banqueo_commissions.lanave_participation_percentage_usd IS 'Participación de Lanave (única por cliente) en Dólares';
COMMENT ON TABLE public.client_banqueo_commissions IS 'Almacena las comisiones del cliente y la participación de Lanave (única por cliente)';

COMMENT ON TABLE public.client_system_participation IS 'Almacena los porcentajes de participación del cliente por sistema de lotería (puede variar por sistema)';

