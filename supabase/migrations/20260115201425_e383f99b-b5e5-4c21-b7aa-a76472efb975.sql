-- Add deposit_bs field to weekly_cuadre_config
ALTER TABLE public.weekly_cuadre_config 
ADD COLUMN IF NOT EXISTS deposit_bs numeric DEFAULT 0;