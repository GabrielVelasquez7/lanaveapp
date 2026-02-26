
-- Delete session-dependent records first
DELETE FROM sales_transactions WHERE session_id IN ('fdc63215-30bd-4e89-bf38-6455f3ea0399','1ab3ad45-6e01-4465-b44d-675a32207b1b');
DELETE FROM prize_transactions WHERE session_id IN ('fdc63215-30bd-4e89-bf38-6455f3ea0399','1ab3ad45-6e01-4465-b44d-675a32207b1b');
DELETE FROM expenses WHERE session_id IN ('fdc63215-30bd-4e89-bf38-6455f3ea0399','1ab3ad45-6e01-4465-b44d-675a32207b1b');
DELETE FROM mobile_payments WHERE session_id IN ('fdc63215-30bd-4e89-bf38-6455f3ea0399','1ab3ad45-6e01-4465-b44d-675a32207b1b');
DELETE FROM point_of_sale WHERE session_id IN ('fdc63215-30bd-4e89-bf38-6455f3ea0399','1ab3ad45-6e01-4465-b44d-675a32207b1b');
DELETE FROM pending_prizes WHERE session_id IN ('fdc63215-30bd-4e89-bf38-6455f3ea0399','1ab3ad45-6e01-4465-b44d-675a32207b1b');

-- Delete agency-level records
DELETE FROM daily_cuadres_summary WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8');
DELETE FROM encargada_cuadre_details WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8');
DELETE FROM expenses WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8');
DELETE FROM mobile_payments WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8');
DELETE FROM point_of_sale WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8');
DELETE FROM weekly_bank_expenses WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8');
DELETE FROM weekly_system_totals WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8');
DELETE FROM weekly_cuadre_config WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8');
DELETE FROM employees WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8');

-- Delete sessions
DELETE FROM daily_sessions WHERE user_id IN (SELECT user_id FROM profiles WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8'));

-- Delete user roles and profiles
DELETE FROM user_roles WHERE user_id IN (SELECT user_id FROM profiles WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8'));
DELETE FROM profiles WHERE agency_id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8');

-- Finally delete the agencies
DELETE FROM agencies WHERE id IN ('3dcdcfed-cbec-439b-a381-7347fcf5ad15','9bb572d7-2c19-46f8-96b1-ffd9041cb4d8');
