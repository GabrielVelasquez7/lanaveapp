-- Add lanave participation columns to client_system_participation table
-- This allows configuring lanave participation per client AND per system

ALTER TABLE public.client_system_participation 
ADD COLUMN lanave_participation_percentage_bs numeric NOT NULL DEFAULT 0,
ADD COLUMN lanave_participation_percentage_usd numeric NOT NULL DEFAULT 0;