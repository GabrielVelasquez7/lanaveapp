-- Indexes for daily_sessions lookups
CREATE INDEX IF NOT EXISTS idx_daily_sessions_agency_date ON daily_sessions(agency_id, session_date);
CREATE INDEX IF NOT EXISTS idx_daily_sessions_user_date ON daily_sessions(user_id, session_date);

-- Indexes for encargada_cuadre_details lookups
CREATE INDEX IF NOT EXISTS idx_encargada_details_agency_date ON encargada_cuadre_details(agency_id, session_date);

-- Indexes for daily_cuadres_summary lookups
CREATE INDEX IF NOT EXISTS idx_daily_summary_agency_date ON daily_cuadres_summary(agency_id, session_date);

-- Indexes for transaction tables by session_id (often used in joins/filters)
CREATE INDEX IF NOT EXISTS idx_sales_transactions_session_id ON sales_transactions(session_id);
CREATE INDEX IF NOT EXISTS idx_prize_transactions_session_id ON prize_transactions(session_id);
CREATE INDEX IF NOT EXISTS idx_expenses_transactions_session_id ON expenses_transactions(session_id);
CREATE INDEX IF NOT EXISTS idx_mobile_payments_session_id ON mobile_payments(session_id);
CREATE INDEX IF NOT EXISTS idx_point_of_sale_session_id ON point_of_sale_transactions(session_id);

-- Indexes for lottery systems
CREATE INDEX IF NOT EXISTS idx_lottery_systems_parent_id ON lottery_systems(parent_system_id);
