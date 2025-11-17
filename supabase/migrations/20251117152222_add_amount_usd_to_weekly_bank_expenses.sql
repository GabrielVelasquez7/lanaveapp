-- Add amount_usd column to weekly_bank_expenses table
ALTER TABLE public.weekly_bank_expenses
ADD COLUMN IF NOT EXISTS amount_usd numeric NOT NULL DEFAULT 0;

