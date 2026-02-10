
-- Delete transactions linked to agenciaprueba's session
DELETE FROM sales_transactions WHERE session_id = 'b529e289-3848-4908-a895-9921e2a74cb2';
DELETE FROM prize_transactions WHERE session_id = 'b529e289-3848-4908-a895-9921e2a74cb2';

-- Delete encargada cuadre details for both users today
DELETE FROM encargada_cuadre_details 
WHERE user_id IN ('561e38cd-129e-4bc1-b4b4-f018b494bade', 'e192f2fe-ed79-4011-9908-7c74506c4eb6') 
AND session_date = '2026-02-09';

-- Delete daily cuadres summary for both users today
DELETE FROM daily_cuadres_summary 
WHERE user_id IN ('561e38cd-129e-4bc1-b4b4-f018b494bade', 'e192f2fe-ed79-4011-9908-7c74506c4eb6') 
AND session_date = '2026-02-09';

-- Delete daily session for agenciaprueba
DELETE FROM daily_sessions WHERE id = 'b529e289-3848-4908-a895-9921e2a74cb2';
