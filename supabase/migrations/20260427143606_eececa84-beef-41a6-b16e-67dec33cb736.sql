-- Eliminar registros de las agencias PRUEBA y PRUEBA 2
DELETE FROM sales_transactions WHERE session_id IN (SELECT id FROM daily_sessions WHERE EXISTS (SELECT 1 FROM expenses e WHERE e.session_id = daily_sessions.id AND e.agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8')));

DELETE FROM sales_transactions WHERE session_id IN (
  SELECT DISTINCT session_id FROM expenses WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8') AND session_id IS NOT NULL
  UNION SELECT DISTINCT session_id FROM mobile_payments WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8') AND session_id IS NOT NULL
  UNION SELECT DISTINCT session_id FROM point_of_sale WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8') AND session_id IS NOT NULL
  UNION SELECT DISTINCT session_id FROM daily_cuadres_summary WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8') AND session_id IS NOT NULL
);

DELETE FROM prize_transactions WHERE session_id IN (
  SELECT DISTINCT session_id FROM expenses WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8') AND session_id IS NOT NULL
  UNION SELECT DISTINCT session_id FROM mobile_payments WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8') AND session_id IS NOT NULL
  UNION SELECT DISTINCT session_id FROM point_of_sale WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8') AND session_id IS NOT NULL
  UNION SELECT DISTINCT session_id FROM daily_cuadres_summary WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8') AND session_id IS NOT NULL
);

DELETE FROM pending_prizes WHERE session_id IN (
  SELECT DISTINCT session_id FROM daily_cuadres_summary WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8') AND session_id IS NOT NULL
);

DELETE FROM mobile_payments WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8');
DELETE FROM point_of_sale WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8');
DELETE FROM expenses WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8');

DELETE FROM taquillera_daily_snapshot WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8');
DELETE FROM weekly_cuadre_config WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8');
DELETE FROM weekly_system_totals WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8');
DELETE FROM weekly_bank_expenses WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8');

DELETE FROM weekly_payroll WHERE employee_id IN (SELECT id FROM employees WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8'));
DELETE FROM employees WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8');

DELETE FROM encargada_cuadre_details WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8');
DELETE FROM daily_cuadres_summary WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8');

DELETE FROM inter_agency_loans WHERE from_agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8') OR to_agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8');
DELETE FROM inter_agency_debts WHERE debtor_agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8') OR creditor_agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8');

-- Sesiones diarias: la tabla daily_sessions no tiene agency_id, se relacionan via daily_cuadres_summary
-- Las sesiones huérfanas se mantienen (pertenecen a usuarios)

DELETE FROM agencies WHERE id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8');