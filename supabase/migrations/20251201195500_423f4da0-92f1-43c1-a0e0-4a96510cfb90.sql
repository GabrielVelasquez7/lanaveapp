-- Add is_client_group field to agency_groups table
ALTER TABLE public.agency_groups 
ADD COLUMN is_client_group boolean NOT NULL DEFAULT false;

-- Add comment to explain the field
COMMENT ON COLUMN public.agency_groups.is_client_group IS 'Indica si este grupo es para clientes. Los grupos de clientes no se incluyen en los cálculos de ganancias.';