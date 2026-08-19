-- Shift tracking for ride-sharing business
-- Run this in Supabase SQL Editor

-- Drivers table
CREATE TABLE IF NOT EXISTS drivers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  share_percent DECIMAL(5,2) NOT NULL DEFAULT 50.00, -- profit split %
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL, -- e.g., "2001 Vitz"
  plate TEXT,
  fuel_consumption_l_per_100km DECIMAL(5,2) NOT NULL DEFAULT 6.5,
  rental_cost_per_day DECIMAL(10,2) NOT NULL DEFAULT 1400,
  maintenance_reserve_per_day DECIMAL(10,2) NOT NULL DEFAULT 500,
  misc_per_day DECIMAL(10,2) NOT NULL DEFAULT 200,
  fuel_price_per_liter DECIMAL(10,2) NOT NULL DEFAULT 167.50,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shifts table - core tracking
CREATE TABLE IF NOT EXISTS shifts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE NOT NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  gross_br DECIMAL(10,2) NOT NULL CHECK (gross_br >= 0),
  fuel_br DECIMAL(10,2) NOT NULL CHECK (fuel_br >= 0),
  kilometers INTEGER NOT NULL CHECK (kilometers >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(driver_id, shift_date) -- one shift per driver per day
);

-- Enable RLS
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

-- Drivers policies
CREATE POLICY "Users can view own driver profile" ON drivers
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own driver profile" ON drivers
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own driver profile" ON drivers
  FOR UPDATE USING (auth.uid() = user_id);

-- Vehicles policies (read for all authenticated, write for owner)
CREATE POLICY "Authenticated can view active vehicles" ON vehicles
  FOR SELECT USING (auth.role() = 'authenticated' AND is_active = TRUE);
CREATE POLICY "Service role manages vehicles" ON vehicles
  FOR ALL USING (auth.role() = 'service_role');

-- Shifts policies
CREATE POLICY "Users can view own shifts" ON shifts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM drivers d WHERE d.id = shifts.driver_id AND d.user_id = auth.uid())
  );
CREATE POLICY "Users can insert own shifts" ON shifts
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM drivers d WHERE d.id = shifts.driver_id AND d.user_id = auth.uid())
  );
CREATE POLICY "Users can update own shifts (same day)" ON shifts
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM drivers d WHERE d.id = shifts.driver_id AND d.user_id = auth.uid())
  );

-- Updated at trigger
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shifts_updated_at
  BEFORE UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- View: Daily business summary (both drivers combined)
CREATE OR REPLACE VIEW daily_business_summary AS
SELECT
  s.shift_date,
  v.id as vehicle_id,
  v.name as vehicle_name,
  v.rental_cost_per_day,
  v.maintenance_reserve_per_day,
  v.misc_per_day,
  v.fuel_price_per_liter,
  v.fuel_consumption_l_per_100km,
  COALESCE(SUM(s.gross_br), 0) as total_gross,
  COALESCE(SUM(s.fuel_br), 0) as total_fuel_cost,
  COALESCE(SUM(s.kilometers), 0) as total_km,
  COUNT(s.id) as shifts_count,
  -- Calculated fields
  COALESCE(SUM(s.gross_br), 0) - COALESCE(SUM(s.fuel_br), 0) - v.misc_per_day as net_after_fuel_misc,
  COALESCE(SUM(s.gross_br), 0) - COALESCE(SUM(s.fuel_br), 0) - v.misc_per_day - v.rental_cost_per_day - v.maintenance_reserve_per_day as true_profit
FROM shifts s
JOIN vehicles v ON v.id = s.vehicle_id
WHERE v.is_active = TRUE
GROUP BY s.shift_date, v.id, v.name, v.rental_cost_per_day, v.maintenance_reserve_per_day, v.misc_per_day, v.fuel_price_per_liter, v.fuel_consumption_l_per_100km
ORDER BY s.shift_date DESC;

-- View: Driver daily deposit calculation
CREATE OR REPLACE VIEW driver_daily_deposit AS
SELECT
  s.id as shift_id,
  s.driver_id,
  d.name as driver_name,
  d.share_percent,
  s.vehicle_id,
  s.shift_date,
  s.start_time,
  s.end_time,
  s.gross_br,
  s.fuel_br,
  s.kilometers,
  s.notes,
  v.rental_cost_per_day,
  v.maintenance_reserve_per_day,
  v.misc_per_day,
  -- Per-driver deposit = gross - fuel - (misc/2) - (rental/2) - (maintenance/2) * share%
  -- Actually: each driver deposits (gross - fuel - their share of fixed costs)
  s.gross_br - s.fuel_br - (v.misc_per_day / 2.0) as deposit_before_fixed,
  s.gross_br - s.fuel_br - (v.misc_per_day / 2.0) - (v.rental_cost_per_day / 2.0) - (v.maintenance_reserve_per_day / 2.0) as full_deposit
FROM shifts s
JOIN drivers d ON d.id = s.driver_id
JOIN vehicles v ON v.id = s.vehicle_id
WHERE d.is_active = TRUE AND v.is_active = TRUE
ORDER BY s.shift_date DESC, d.name;

-- View: Weekly summary (Monday-Sunday)
CREATE OR REPLACE VIEW weekly_summary AS
SELECT
  DATE_TRUNC('week', shift_date)::DATE as week_start,
  (DATE_TRUNC('week', shift_date) + INTERVAL '6 days')::DATE as week_end,
  vehicle_id,
  vehicle_name,
  COUNT(DISTINCT shift_date) as operating_days,
  COUNT(*) as total_shifts,
  SUM(total_gross) as week_gross,
  SUM(total_fuel_cost) as week_fuel,
  SUM(total_km) as week_km,
  SUM(total_gross - total_fuel_cost - misc_per_day) as week_net_after_fuel_misc,
  SUM(true_profit) as week_true_profit,
  SUM(rental_cost_per_day) as week_rental,
  SUM(maintenance_reserve_per_day) as week_maintenance_reserve
FROM daily_business_summary
GROUP BY DATE_TRUNC('week', shift_date), vehicle_id, vehicle_name
ORDER BY week_start DESC;

-- View: Monthly summary
CREATE OR REPLACE VIEW monthly_summary AS
SELECT
  DATE_TRUNC('month', shift_date)::DATE as month_start,
  (DATE_TRUNC('month', shift_date) + INTERVAL '1 month - 1 day')::DATE as month_end,
  vehicle_id,
  vehicle_name,
  COUNT(DISTINCT shift_date) as operating_days,
  COUNT(*) as total_shifts,
  SUM(total_gross) as month_gross,
  SUM(total_fuel_cost) as month_fuel,
  SUM(total_km) as month_km,
  SUM(total_gross - total_fuel_cost - misc_per_day) as month_net_after_fuel_misc,
  SUM(true_profit) as month_true_profit,
  SUM(rental_cost_per_day) as month_rental,
  SUM(maintenance_reserve_per_day) as month_maintenance_reserve
FROM daily_business_summary
GROUP BY DATE_TRUNC('month', shift_date), vehicle_id, vehicle_name
ORDER BY month_start DESC;