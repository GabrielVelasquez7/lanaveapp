-- Add USD column to pending_prizes table
ALTER TABLE public.pending_prizes 
ADD COLUMN IF NOT EXISTS amount_usd numeric NOT NULL DEFAULT 0;