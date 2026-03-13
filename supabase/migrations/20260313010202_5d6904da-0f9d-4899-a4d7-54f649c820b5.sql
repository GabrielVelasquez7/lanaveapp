
-- Delete all PRUEBA agency data for March 12, 2026
DELETE FROM encargada_cuadre_details WHERE agency_id = '3dcdcfed-cbec-439b-a381-7347fcf5ad15' AND session_date = '2026-03-12';
DELETE FROM daily_cuadres_summary WHERE agency_id = '3dcdcfed-cbec-439b-a381-7347fcf5ad15' AND session_date = '2026-03-12';
DELETE FROM point_of_sale WHERE agency_id = '3dcdcfed-cbec-439b-a381-7347fcf5ad15' AND transaction_date = '2026-03-12';
DELETE FROM mobile_payments WHERE agency_id = '3dcdcfed-cbec-439b-a381-7347fcf5ad15' AND transaction_date = '2026-03-12';
