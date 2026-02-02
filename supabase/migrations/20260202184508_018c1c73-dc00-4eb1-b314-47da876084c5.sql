-- Add pending_prizes_usd column to daily_cuadres_summary table
ALTER TABLE public.daily_cuadres_summary 
ADD COLUMN IF NOT EXISTS pending_prizes_usd numeric NOT NULL DEFAULT 0;