
DO $$
DECLARE
  v_user_id uuid := 'c35049f8-63ec-4cfb-a29c-a5c51c52f69e';
  v_agency_id uuid := '3dcdcfed-cbec-439b-a381-7347fcf5ad15';
  v_system_id uuid := 'b8162d85-f29b-4435-ab18-b0f18d5e4254';
  v_session_id uuid;
  v_dates date[] := ARRAY['2026-04-18'::date, '2026-04-19'::date, '2026-04-20'::date];
  v_date date;
  v_ref_counter int := 9200;
BEGIN
  FOREACH v_date IN ARRAY v_dates LOOP
    SELECT id INTO v_session_id FROM public.daily_sessions
    WHERE user_id = v_user_id AND session_date = v_date;

    IF v_session_id IS NULL THEN
      INSERT INTO public.daily_sessions (user_id, session_date, cash_available_bs, cash_available_usd, exchange_rate, is_closed, daily_closure_confirmed)
      VALUES (v_user_id, v_date, 1000, 0, 36, false, true)
      RETURNING id INTO v_session_id;
    END IF;

    INSERT INTO public.sales_transactions (session_id, lottery_system_id, amount_bs, amount_usd)
    VALUES (v_session_id, v_system_id, 40, 0);

    INSERT INTO public.prize_transactions (session_id, lottery_system_id, amount_bs, amount_usd)
    VALUES (v_session_id, v_system_id, 10, 0);

    INSERT INTO public.expenses (session_id, agency_id, category, description, amount_bs, amount_usd, transaction_date, is_paid)
    VALUES (v_session_id, v_agency_id, 'gasto_operativo', 'pago', 15, 10, v_date, false);

    INSERT INTO public.mobile_payments (session_id, agency_id, reference_number, amount_bs, description, transaction_date)
    VALUES (v_session_id, v_agency_id, (v_ref_counter)::text, 1000, '[RECIBIDO]', v_date);
    v_ref_counter := v_ref_counter + 1;

    INSERT INTO public.point_of_sale (session_id, agency_id, amount_bs, transaction_date)
    VALUES (v_session_id, v_agency_id, 10, v_date)
    ON CONFLICT (session_id) DO UPDATE SET amount_bs = point_of_sale.amount_bs + 10;

    INSERT INTO public.pending_prizes (session_id, amount_bs, amount_usd, is_paid)
    VALUES (v_session_id, 12313, 0, false);
  END LOOP;
END $$;
