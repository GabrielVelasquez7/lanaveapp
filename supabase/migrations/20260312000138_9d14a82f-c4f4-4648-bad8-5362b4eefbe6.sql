
-- Eliminar transacciones de las sesiones del usuario Gabriel (PRUEBA)
DELETE FROM sales_transactions WHERE session_id IN ('64e2a796-d13d-48f6-b6c5-d4d4ae2ef28a', '683d2b26-6a96-4291-86d3-865bdf7a94f6');
DELETE FROM prize_transactions WHERE session_id IN ('64e2a796-d13d-48f6-b6c5-d4d4ae2ef28a', '683d2b26-6a96-4291-86d3-865bdf7a94f6');
DELETE FROM pending_prizes WHERE session_id IN ('64e2a796-d13d-48f6-b6c5-d4d4ae2ef28a', '683d2b26-6a96-4291-86d3-865bdf7a94f6');
DELETE FROM expenses WHERE session_id IN ('64e2a796-d13d-48f6-b6c5-d4d4ae2ef28a', '683d2b26-6a96-4291-86d3-865bdf7a94f6');
DELETE FROM mobile_payments WHERE session_id IN ('64e2a796-d13d-48f6-b6c5-d4d4ae2ef28a', '683d2b26-6a96-4291-86d3-865bdf7a94f6');
DELETE FROM point_of_sale WHERE session_id IN ('64e2a796-d13d-48f6-b6c5-d4d4ae2ef28a', '683d2b26-6a96-4291-86d3-865bdf7a94f6');

-- Eliminar cuadres summary de la agencia PRUEBA
DELETE FROM daily_cuadres_summary WHERE agency_id = '3dcdcfed-cbec-439b-a381-7347fcf5ad15';

-- Eliminar encargada cuadre details de la agencia PRUEBA
DELETE FROM encargada_cuadre_details WHERE agency_id = '3dcdcfed-cbec-439b-a381-7347fcf5ad15';

-- Eliminar sesiones del usuario
DELETE FROM daily_sessions WHERE user_id = '54d4bb34-6159-4dda-8108-060099eab084';

-- Eliminar weekly data
DELETE FROM weekly_cuadre_config WHERE agency_id = '3dcdcfed-cbec-439b-a381-7347fcf5ad15';
DELETE FROM weekly_system_totals WHERE agency_id = '3dcdcfed-cbec-439b-a381-7347fcf5ad15';
DELETE FROM weekly_bank_expenses WHERE agency_id = '3dcdcfed-cbec-439b-a381-7347fcf5ad15';
