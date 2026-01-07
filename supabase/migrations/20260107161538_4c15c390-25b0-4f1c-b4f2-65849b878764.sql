-- Eliminar cuadres de prueba: AV SUCRE 2025-12-28 y CEMENTERIO 2026-01-07

DELETE FROM public.encargada_cuadre_details
WHERE id IN ('bd3c961f-ad2e-4d60-938a-ddc330911be8', 'decb92f7-833c-4699-8a4f-d5c1fcac1165');

DELETE FROM public.daily_cuadres_summary
WHERE id IN ('dc5bd0da-1137-43ea-8777-fdf9c20a90dc', '3ba4133e-ea7f-4645-8da2-5a0e2df31fba');