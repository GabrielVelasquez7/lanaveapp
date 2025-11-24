-- Add payment status columns to banqueo_transactions
ALTER TABLE public.banqueo_transactions 
ADD COLUMN paid_bs BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN paid_usd BOOLEAN NOT NULL DEFAULT FALSE;