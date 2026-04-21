
CREATE TABLE public.taquillera_daily_snapshot (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid NOT NULL,
  session_date date NOT NULL,
  sales_bs numeric NOT NULL DEFAULT 0,
  sales_usd numeric NOT NULL DEFAULT 0,
  prizes_bs numeric NOT NULL DEFAULT 0,
  prizes_usd numeric NOT NULL DEFAULT 0,
  gastos_bs numeric NOT NULL DEFAULT 0,
  gastos_usd numeric NOT NULL DEFAULT 0,
  deudas_bs numeric NOT NULL DEFAULT 0,
  deudas_usd numeric NOT NULL DEFAULT 0,
  pago_movil_recibidos_bs numeric NOT NULL DEFAULT 0,
  pago_movil_pagados_bs numeric NOT NULL DEFAULT 0,
  point_of_sale_bs numeric NOT NULL DEFAULT 0,
  pending_prizes_bs numeric NOT NULL DEFAULT 0,
  pending_prizes_usd numeric NOT NULL DEFAULT 0,
  cash_available_bs numeric NOT NULL DEFAULT 0,
  cash_available_usd numeric NOT NULL DEFAULT 0,
  exchange_rate numeric NOT NULL DEFAULT 36,
  additional_amount_bs numeric NOT NULL DEFAULT 0,
  additional_amount_usd numeric NOT NULL DEFAULT 0,
  taquillera_session_ids uuid[] NOT NULL DEFAULT '{}',
  captured_at timestamp with time zone NOT NULL DEFAULT venezuela_now(),
  captured_by uuid,
  UNIQUE (agency_id, session_date)
);

ALTER TABLE public.taquillera_daily_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and encargada can view snapshots"
ON public.taquillera_daily_snapshot
FOR SELECT
USING (
  has_role(auth.uid(), 'administrador'::user_role)
  OR has_role(auth.uid(), 'encargada'::user_role)
);

CREATE POLICY "Admin and encargada can insert snapshots"
ON public.taquillera_daily_snapshot
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'administrador'::user_role)
  OR has_role(auth.uid(), 'encargada'::user_role)
);

CREATE POLICY "Only admin can update snapshots"
ON public.taquillera_daily_snapshot
FOR UPDATE
USING (has_role(auth.uid(), 'administrador'::user_role))
WITH CHECK (has_role(auth.uid(), 'administrador'::user_role));

CREATE POLICY "Only admin can delete snapshots"
ON public.taquillera_daily_snapshot
FOR DELETE
USING (has_role(auth.uid(), 'administrador'::user_role));

CREATE INDEX idx_taquillera_snapshot_agency_date 
  ON public.taquillera_daily_snapshot(agency_id, session_date);
