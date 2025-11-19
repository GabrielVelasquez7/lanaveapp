-- Add USD amount column to weekly_bank_expenses table
ALTER TABLE public.weekly_bank_expenses
ADD COLUMN IF NOT EXISTS amount_usd numeric NOT NULL DEFAULT 0;

-- Add comment explaining the columns
COMMENT ON COLUMN public.weekly_bank_expenses.amount_bs IS 'Monto del gasto en Bolívares';
COMMENT ON COLUMN public.weekly_bank_expenses.amount_usd IS 'Monto del gasto en Dólares';