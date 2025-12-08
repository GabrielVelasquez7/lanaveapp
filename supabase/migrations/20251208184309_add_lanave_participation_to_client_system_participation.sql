-- Agregar campos de participación de La Nave por sistema y por cliente
ALTER TABLE public.client_system_participation
ADD COLUMN lanave_participation_percentage_bs NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (lanave_participation_percentage_bs >= 0 AND lanave_participation_percentage_bs <= 100),
ADD COLUMN lanave_participation_percentage_usd NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (lanave_participation_percentage_usd >= 0 AND lanave_participation_percentage_usd <= 100);

-- Agregar comentarios para explicar los nuevos campos
COMMENT ON COLUMN public.client_system_participation.lanave_participation_percentage_bs IS 'Participación de La Nave en Bolívares por sistema y por cliente (puede variar por sistema)';
COMMENT ON COLUMN public.client_system_participation.lanave_participation_percentage_usd IS 'Participación de La Nave en Dólares por sistema y por cliente (puede variar por sistema)';

-- Actualizar el comentario de la tabla
COMMENT ON TABLE public.client_system_participation IS 'Almacena la comisión del cliente, su participación y la participación de La Nave por sistema de lotería (puede variar por sistema)';

