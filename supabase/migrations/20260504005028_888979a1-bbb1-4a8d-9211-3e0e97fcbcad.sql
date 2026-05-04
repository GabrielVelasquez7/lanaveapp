-- Catálogo de bancos POS
CREATE TABLE public.pos_banks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  variable_percentage numeric NOT NULL DEFAULT 0,
  monthly_fixed_usd numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT venezuela_now(),
  updated_at timestamptz NOT NULL DEFAULT venezuela_now()
);

ALTER TABLE public.pos_banks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage pos_banks" ON public.pos_banks
  FOR ALL USING (has_role(auth.uid(), 'administrador'::user_role))
  WITH CHECK (has_role(auth.uid(), 'administrador'::user_role));

CREATE POLICY "Encargadas view pos_banks" ON public.pos_banks
  FOR SELECT USING (has_role(auth.uid(), 'encargada'::user_role));

CREATE TRIGGER trg_pos_banks_updated
  BEFORE UPDATE ON public.pos_banks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column_venezuela();

-- Asignación agencia ↔ banco(s)
CREATE TABLE public.agency_pos_banks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid NOT NULL,
  bank_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT venezuela_now(),
  updated_at timestamptz NOT NULL DEFAULT venezuela_now(),
  UNIQUE(agency_id, bank_id)
);

ALTER TABLE public.agency_pos_banks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage agency_pos_banks" ON public.agency_pos_banks
  FOR ALL USING (has_role(auth.uid(), 'administrador'::user_role))
  WITH CHECK (has_role(auth.uid(), 'administrador'::user_role));

CREATE POLICY "Encargadas view agency_pos_banks" ON public.agency_pos_banks
  FOR SELECT USING (has_role(auth.uid(), 'encargada'::user_role));

CREATE TRIGGER trg_agency_pos_banks_updated
  BEFORE UPDATE ON public.agency_pos_banks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column_venezuela();

-- Split manual de ventas semanales para multi-banco (ej. Baralt)
CREATE TABLE public.weekly_pos_split (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid NOT NULL,
  bank_id uuid NOT NULL,
  week_start_date date NOT NULL,
  week_end_date date NOT NULL,
  sales_bs numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT venezuela_now(),
  updated_at timestamptz NOT NULL DEFAULT venezuela_now(),
  UNIQUE(agency_id, bank_id, week_start_date)
);

ALTER TABLE public.weekly_pos_split ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage weekly_pos_split" ON public.weekly_pos_split
  FOR ALL USING (has_role(auth.uid(), 'administrador'::user_role))
  WITH CHECK (has_role(auth.uid(), 'administrador'::user_role));

CREATE POLICY "Encargadas manage weekly_pos_split" ON public.weekly_pos_split
  FOR ALL USING (has_role(auth.uid(), 'encargada'::user_role))
  WITH CHECK (has_role(auth.uid(), 'encargada'::user_role));

CREATE TRIGGER trg_weekly_pos_split_updated
  BEFORE UPDATE ON public.weekly_pos_split
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column_venezuela();

-- Auditoría/histórico de comisiones generadas por semana
CREATE TABLE public.weekly_pos_commissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid NOT NULL,
  bank_id uuid NOT NULL,
  week_start_date date NOT NULL,
  week_end_date date NOT NULL,
  sales_bs numeric NOT NULL DEFAULT 0,
  variable_percentage numeric NOT NULL DEFAULT 0,
  variable_amount_bs numeric NOT NULL DEFAULT 0,
  monthly_fixed_usd numeric NOT NULL DEFAULT 0,
  fixed_amount_bs numeric NOT NULL DEFAULT 0,
  total_bs numeric NOT NULL DEFAULT 0,
  bcv_rate numeric NOT NULL DEFAULT 0,
  weekly_bank_expense_id uuid,
  generated_by uuid,
  created_at timestamptz NOT NULL DEFAULT venezuela_now(),
  updated_at timestamptz NOT NULL DEFAULT venezuela_now(),
  UNIQUE(agency_id, bank_id, week_start_date)
);

ALTER TABLE public.weekly_pos_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage weekly_pos_commissions" ON public.weekly_pos_commissions
  FOR ALL USING (has_role(auth.uid(), 'administrador'::user_role))
  WITH CHECK (has_role(auth.uid(), 'administrador'::user_role));

CREATE POLICY "Encargadas manage weekly_pos_commissions" ON public.weekly_pos_commissions
  FOR ALL USING (has_role(auth.uid(), 'encargada'::user_role))
  WITH CHECK (has_role(auth.uid(), 'encargada'::user_role));

CREATE TRIGGER trg_weekly_pos_commissions_updated
  BEFORE UPDATE ON public.weekly_pos_commissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column_venezuela();

-- Seed bancos
INSERT INTO public.pos_banks (name, variable_percentage, monthly_fixed_usd) VALUES
  ('Banesco', 0.75, 30.00),
  ('BNC', 2.50, 26.00),
  ('Bancamiga', 2.00, 1.00);

-- Seed asignación agencia↔banco basado en nombres existentes
INSERT INTO public.agency_pos_banks (agency_id, bank_id)
SELECT a.id, b.id
FROM public.agencies a
CROSS JOIN public.pos_banks b
WHERE
  (b.name = 'Banesco' AND a.name ILIKE ANY (ARRAY['%Victoria 1%','%San Martin%','%San Martín%','%Miraflores%','%Panteon 1%','%Panteón 1%','%Cementerio%','%Baralt%']))
  OR
  (b.name = 'BNC' AND a.name ILIKE ANY (ARRAY['%Av. Sucre%','%Av Sucre%','%Sucre%','%Glorieta%','%Victoria 2%','%Candelaria%','%Paraiso%','%Paraíso%']))
  OR
  (b.name = 'Bancamiga' AND a.name ILIKE '%Baralt%')
ON CONFLICT (agency_id, bank_id) DO NOTHING;

CREATE INDEX idx_weekly_pos_commissions_week ON public.weekly_pos_commissions(week_start_date, agency_id);
CREATE INDEX idx_weekly_pos_split_week ON public.weekly_pos_split(week_start_date, agency_id);
CREATE INDEX idx_agency_pos_banks_agency ON public.agency_pos_banks(agency_id);