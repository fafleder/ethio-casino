'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { upsertShift, getTodayShift, getActiveVehicle, validateShiftInput, calculateFuelCost } from '@/lib/shifts'
import { ShiftInput } from '@/types/shifts'

const supabase = createClient()

export function ShiftForm() {
  const router = useRouter()
  const [form, setForm] = useState<ShiftInput>({
    shift_date: new Date().toISOString().split('T')[0],
    start_time: '08:00',
    end_time: '16:00',
    gross_br: 0,
    fuel_br: 0,
    kilometers: 0,
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [vehicle, setVehicle] = useState<{ fuel_consumption_l_per_100km: number; fuel_price_per_liter: number } | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    loadVehicle()
    loadTodayShift()
  }, [])

  const loadVehicle = async () => {
    const { data } = await supabase
      .from('vehicles')
      .select('fuel_consumption_l_per_100km, fuel_price_per_liter')
      .eq('is_active', true)
      .single()
    if (data) setVehicle(data)
  }

  const loadTodayShift = async () => {
    setLoading(true)
    const shift = await getTodayShift()
    if (shift) {
      setForm({
        shift_date: shift.shift_date,
        start_time: shift.start_time.slice(0, 5),
        end_time: shift.end_time.slice(0, 5),
        gross_br: shift.gross_br,
        fuel_br: shift.fuel_br,
        kilometers: shift.kilometers,
        notes: shift.notes || '',
      })
      setIsEditing(true)
    }
    setLoading(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }))
    setError('')
    setSuccess('')
  }

  const handleCalcFuel = () => {
    if (vehicle && form.kilometers > 0) {
      const calc = calculateFuelCost(form.kilometers, vehicle.fuel_consumption_l_per_100km, vehicle.fuel_price_per_liter)
      setForm(prev => ({ ...prev, fuel_br: Math.round(calc * 100) / 100 }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const validationError = validateShiftInput(form)
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    const { shift, error: saveError } = await upsertShift(form)
    setSaving(false)

    if (saveError) {
      setError(saveError)
    } else {
      setSuccess(isEditing ? 'Shift updated!' : 'Shift saved!')
      setIsEditing(true)
      // Refresh dashboard data
      router.refresh()
    }
  }

  if (loading) {
    return (
      <div className="card-glass p-6 animate-pulse">
        <div className="h-8 bg-white/10 rounded w-1/4 mb-4" />
        <div className="space-y-4">
          <div className="h-10 bg-white/10 rounded" />
          <div className="h-10 bg-white/10 rounded" />
          <div className="h-10 bg-white/10 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="card-glass p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold gradient-gold">
          {isEditing ? 'Edit Today\'s Shift' : 'Log Today\'s Shift'}
        </h3>
        {isEditing && (
          <span className="text-xs text-gray-500">Auto-saves on submit</span>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-300 text-sm">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Date</label>
            <input
              type="date"
              name="shift_date"
              value={form.shift_date}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Vehicle</label>
            <select
              name="vehicle"
              disabled
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none"
            >
              <option value="">2001 Vitz (Active)</option>
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Start Time</label>
            <input
              type="time"
              name="start_time"
              value={form.start_time}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-yellow-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">End Time</label>
            <input
              type="time"
              name="end_time"
              value={form.end_time}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-yellow-500"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Gross (Br)</label>
            <input
              type="number"
              name="gross_br"
              value={form.gross_br}
              onChange={handleChange}
              step="1"
              min="0"
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-yellow-500"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Fuel Cost (Br)</label>
            <input
              type="number"
              name="fuel_br"
              value={form.fuel_br}
              onChange={handleChange}
              step="0.01"
              min="0"
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-yellow-500"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Kilometers</label>
            <input
              type="number"
              name="kilometers"
              value={form.kilometers}
              onChange={handleChange}
              step="1"
              min="0"
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-yellow-500"
              placeholder="0"
            />
          </div>
        </div>

        {vehicle && form.kilometers > 0 && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm">
            <span className="text-yellow-400">Calculated fuel:</span>{' '}
            {calculateFuelCost(form.kilometers, vehicle.fuel_consumption_l_per_100km, vehicle.fuel_price_per_liter).toFixed(2)} Br
            {' '}(
            {(form.kilometers * vehicle.fuel_consumption_l_per_100km / 100).toFixed(2)} L × {vehicle.fuel_price_per_liter} Br/L)
            <button
              type="button"
              onClick={handleCalcFuel}
              className="ml-3 text-xs text-yellow-400 hover:underline"
            >
              Use this
            </button>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Notes (optional)</label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={2}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
            placeholder="Rainy day, traffic, etc."
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full btn-primary py-3 disabled:opacity-50"
        >
          {saving ? 'Saving...' : (isEditing ? 'Update Shift' : 'Save Shift')}
        </button>
      </form>

      {/* Quick reference */}
      <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
        <h4 className="font-semibold text-gray-300 mb-2">Quick Reference</h4>
        <div className="grid sm:grid-cols-2 gap-2 text-sm text-gray-400">
          <div>Morning rush (8-10): ~650 Br/hr</div>
          <div>Evening rush (4:30-7:30): ~650 Br/hr</div>
          <div>Normal hours: ~500 Br/hr</div>
          <div>Fuel: ~167.5 Br/L, 6.5L/100km</div>
          <div>Daily fixed: 1400 rent + 500 maint + 200 misc</div>
          <div>Target gross/car/day: ≥ 7,000 Br</div>
        </div>
      </div>
    </div>
  )
}