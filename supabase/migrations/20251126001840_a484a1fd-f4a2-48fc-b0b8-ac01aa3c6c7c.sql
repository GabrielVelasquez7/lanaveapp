-- Borrar todos los datos transaccionales
DELETE FROM public.pending_prizes;
DELETE FROM public.prize_transactions;
DELETE FROM public.sales_transactions;
DELETE FROM public.mobile_payments;
DELETE FROM public.point_of_sale;
DELETE FROM public.expenses;
DELETE FROM public.encargada_cuadre_details;
DELETE FROM public.daily_cuadres_summary;
DELETE FROM public.daily_sessions;
DELETE FROM public.weekly_payroll;
DELETE FROM public.weekly_bank_expenses;
DELETE FROM public.weekly_cuadre_config;
DELETE FROM public.banqueo_transactions;
DELETE FROM public.inter_agency_debts;
DELETE FROM public.inter_agency_loans;