export type Driver = {
  id: string
  user_id: string
  name: string
  share_percent: number
  is_active: boolean
  created_at: string
}

export type Vehicle = {
  id: string
  name: string
  plate: string | null
  fuel_consumption_l_per_100km: number
  rental_cost_per_day: number
  maintenance_reserve_per_day: number
  misc_per_day: number
  fuel_price_per_liter: number
  is_active: boolean
  created_at: string
}

export type Shift = {
  id: string
  driver_id: string
  vehicle_id: string
  shift_date: string // YYYY-MM-DD
  start_time: string // HH:MM
  end_time: string // HH:MM
  gross_br: number
  fuel_br: number
  kilometers: number
  notes: string | null
  created_at: string
  updated_at: string
}

export type ShiftInput = {
  shift_date: string
  start_time: string
  end_time: string
  gross_br: number
  fuel_br: number
  kilometers: number
  notes?: string
}

export type DailyBusinessSummary = {
  shift_date: string
  vehicle_id: string
  vehicle_name: string
  rental_cost_per_day: number
  maintenance_reserve_per_day: number
  misc_per_day: number
  fuel_price_per_liter: number
  fuel_consumption_l_per_100km: number
  total_gross: number
  total_fuel_cost: number
  total_km: number
  shifts_count: number
  net_after_fuel_misc: number
  true_profit: number
}

export type DriverDailyDeposit = {
  shift_id: string
  driver_id: string
  driver_name: string
  share_percent: number
  vehicle_id: string
  shift_date: string
  start_time: string
  end_time: string
  gross_br: number
  fuel_br: number
  kilometers: number
  notes: string | null
  rental_cost_per_day: number
  maintenance_reserve_per_day: number
  misc_per_day: number
  deposit_before_fixed: number
  full_deposit: number
}

export type WeeklySummary = {
  week_start: string
  week_end: string
  vehicle_id: string
  vehicle_name: string
  operating_days: number
  total_shifts: number
  week_gross: number
  week_fuel: number
  week_km: number
  week_net_after_fuel_misc: number
  week_true_profit: number
  week_rental: number
  week_maintenance_reserve: number
}

export type MonthlySummary = {
  month_start: string
  month_end: string
  vehicle_id: string
  vehicle_name: string
  operating_days: number
  total_shifts: number
  month_gross: number
  month_fuel: number
  month_km: number
  month_net_after_fuel_misc: number
  month_true_profit: number
  month_rental: number
  month_maintenance_reserve: number
}