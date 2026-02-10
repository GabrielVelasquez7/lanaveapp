
-- Delete data for agenciaprueba@gmail.com on 2026-02-10
DELETE FROM sales_transactions WHERE session_id = '24b0424e-ee42-496e-8bf8-568d0a012ce2';
DELETE FROM prize_transactions WHERE session_id = '24b0424e-ee42-496e-8bf8-568d0a012ce2';
DELETE FROM daily_cuadres_summary WHERE user_id = 'e192f2fe-ed79-4011-9908-7c74506c4eb6' AND session_date = '2026-02-10';
DELETE FROM daily_sessions WHERE id = '24b0424e-ee42-496e-8bf8-568d0a012ce2';
