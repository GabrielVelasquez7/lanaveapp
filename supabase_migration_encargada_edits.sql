-- Migración para añadir soporte de edición de Encargada sin sobreescribir a la Taquillera
-- Ejecuta esto en el SQL Editor de Supabase

-- 1. Agregar columnas a la tabla expenses
ALTER TABLE public.expenses
ADD COLUMN encargada_amount_bs NUMERIC,
ADD COLUMN encargada_amount_usd NUMERIC;

-- 2. Agregar columna a la tabla mobile_payments
ALTER TABLE public.mobile_payments
ADD COLUMN encargada_amount_bs NUMERIC;

-- 3. Actualizar la caché del esquema de PostgREST
NOTIFY pgrst, 'reload schema';
