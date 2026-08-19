import { createClient } from '@/lib/supabase-client'
import { Shift, ShiftInput, DailyBusinessSummary, DriverDailyDeposit, WeeklySummary, MonthlySummary, Vehicle } from '@/types/shifts'

const supabase = createClient()

// Get current user's driver profile
export async function getMyDriver(): Promise<{ id: string; name: string; share_percent: number } | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const { data } = await supabase
    .from('drivers')
    .select('id, name, share_percent')
    .eq('user_id', session.user.id)
    .eq('is_active', true)
    .single()

  return data
}

// Get active vehicle
export async function getActiveVehicle(): Promise<Vehicle | null> {
  const { data } = await supabase
    .from('vehicles')
    .select('*')
    .eq('is_active', true)
    .single()
  return data
}

// Create or update shift for today
export async function upsertShift(input: ShiftInput): Promise<{ shift: Shift | null; error: string | null }> {
  const driver = await getMyDriver()
  const vehicle = await getActiveVehicle()
  if (!driver || !vehicle) return { shift: null, error: 'Driver or vehicle not found' }

  const { data, error } = await supabase
    .from('shifts')
    .upsert({
      driver_id: driver.id,
      vehicle_id: vehicle.id,
      shift_date: input.shift_date,
      start_time: input.start_time,
      end_time: input.end_time,
      gross_br: input.gross_br,
      fuel_br: input.fuel_br,
      kilometers: input.kilometers,
      notes: input.notes,
    }, { onConflict: 'driver_id,shift_date' })
    .select()
    .single()

  return { shift: data, error: error?.message || null }
}

// Get my shifts for a date range
export async function getMyShifts(fromDate: string, toDate: string): Promise<Shift[]> {
  const driver = await getMyDriver()
  if (!driver) return []

  const { data } = await supabase
    .from('shifts')
    .select('*')
    .eq('driver_id', driver.id)
    .gte('shift_date', fromDate)
    .lte('shift_date', toDate)
    .order('shift_date', { ascending: false })

  return data || []
}

// Get today's shift
export async function getTodayShift(): Promise<Shift | null> {
  const today = new Date().toISOString().split('T')[0]
  const driver = await getMyDriver()
  if (!driver) return null

  const { data } = await supabase
    .from('shifts')
    .select('*')
    .eq('driver_id', driver.id)
    .eq('shift_date', today)
    .single()

  return data
}

// Get daily business summary (both drivers)
export async function getDailyBusinessSummary(days = 30): Promise<DailyBusinessSummary[]> {
  const { data } = await supabase
    .from('daily_business_summary')
    .select('*')
    .order('shift_date', { ascending: false })
    .limit(days)
  return data || []
}

// Get driver daily deposits
export async function getDriverDeposits(days = 30): Promise<DriverDailyDeposit[]> {
  const { data } = await supabase
    .from('driver_daily_deposit')
    .select('*')
    .order('shift_date', { ascending: false })
    .limit(days * 2) // 2 drivers
  return data || []
}

// Get weekly summary
export async function getWeeklySummary(weeks = 12): Promise<WeeklySummary[]> {
  const { data } = await supabase
    .from('weekly_summary')
    .select('*')
    .order('week_start', { ascending: false })
    .limit(weeks)
  return data || []
}

// Get monthly summary
export async function getMonthlySummary(months = 12): Promise<MonthlySummary[]> {
  const { data } = await supabase
    .from('monthly_summary')
    .select('*')
    .order('month_start', { ascending: false })
    .limit(months)
  return data || []
}

// Validation helpers
export function validateShiftInput(input: ShiftInput): string | null {
  if (!input.shift_date) return 'Shift date is required'
  if (!input.start_time || !input.end_time) return 'Start and end time required'
  if (input.gross_br < 0) return 'Gross cannot be negative'
  if (input.fuel_br < 0) return 'Fuel cost cannot be negative'
  if (input.kilometers < 0) return 'Kilometers cannot be negative'
  if (input.gross_br > 100000) return 'Gross seems too high'
  if (input.fuel_br > input.gross_br) return 'Fuel cost cannot exceed gross'
  if (input.kilometers > 500) return 'Kilometers seems too high for a shift'
  return null
}

// Calculate fuel cost from km (for verification)
export function calculateFuelCost(km: number, consumption: number, fuelPrice: number): number {
  return (km * consumption / 100) * fuelPrice
}