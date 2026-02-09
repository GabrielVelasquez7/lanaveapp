-- Create table for weekly system totals (manually adjusted)
CREATE TABLE weekly_system_totals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  lottery_system_id UUID NOT NULL REFERENCES lottery_systems(id) ON DELETE CASCADE,
  
  -- Weekly totals (manually adjusted)
  sales_bs NUMERIC(12,2) NOT NULL DEFAULT 0,
  sales_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  prizes_bs NUMERIC(12,2) NOT NULL DEFAULT 0,
  prizes_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  
  -- Audit fields
  adjusted_by UUID NOT NULL REFERENCES auth.users(id),
  adjusted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure one adjustment per agency/week/system
  UNIQUE(agency_id, week_start_date, lottery_system_id)
);

-- Index for efficient lookups
CREATE INDEX idx_weekly_totals_agency_week 
  ON weekly_system_totals(agency_id, week_start_date);

-- Index for audit queries
CREATE INDEX idx_weekly_totals_adjusted_by 
  ON weekly_system_totals(adjusted_by);

-- Add comment
COMMENT ON TABLE weekly_system_totals IS 'Stores manually adjusted weekly totals per lottery system. When present, these override calculated totals from daily data.';
