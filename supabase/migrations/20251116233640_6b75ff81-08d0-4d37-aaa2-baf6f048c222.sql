-- Add participation2_percentage column to banqueo_transactions
ALTER TABLE public.banqueo_transactions 
ADD COLUMN participation2_percentage numeric NOT NULL DEFAULT 0;