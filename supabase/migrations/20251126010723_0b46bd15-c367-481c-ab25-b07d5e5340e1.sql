-- Habilitar realtime para daily_cuadres_summary con REPLICA IDENTITY FULL
-- para asegurar que los eventos UPDATE incluyan tanto old como new data

ALTER TABLE public.daily_cuadres_summary REPLICA IDENTITY FULL;

-- Agregar la tabla a la publicación de realtime si no está ya
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'daily_cuadres_summary'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_cuadres_summary;
  END IF;
END $$;