'use client'

import { useState, useEffect } from 'react'
import { getDailyBusinessSummary, getDriverDeposits, getWeeklySummary, getMonthlySummary } from '@/lib/shifts'
import { DailyBusinessSummary, DriverDailyDeposit, WeeklySummary, MonthlySummary } from '@/types/shifts'

type Tab = 'daily' | 'weekly' | 'monthly' | 'splits'

export function BusinessReports() {
  const [activeTab, setActiveTab] = useState<Tab>('daily')
  const [daily, setDaily] = useState<DailyBusinessSummary[]>([])
  const [weekly, setWeekly] = useState<WeeklySummary[]>([])
  const [monthly, setMonthly] = useState<MonthlySummary[]>([])
  const [deposits, setDeposits] = useState<DriverDailyDeposit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    const [d, w, m, dep] = await Promise.all([
      getDailyBusinessSummary(60),
      getWeeklySummary(12),
      getMonthlySummary(12),
      getDriverDeposits(60),
    ])
    setDaily(d)
    setWeekly(w)
    setMonthly(m)
    setDeposits(dep)
    setLoading(false)
  }

  const formatBr = (n: number) => new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB', maximumFractionDigits: 0 }).format(n)
  const formatBr2 = (n: number) => new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB', minimumFractionDigits: 2 }).format(n)
  const formatNum = (n: number) => new Intl.NumberFormat('en-ET').format(n)

  const getStatusColor = (profit: number) => {
    if (profit >= 3500) return 'text-green-400'
    if (profit >= 2000) return 'text-yellow-400'
    return 'text-red-400'
  }

  if (loading) {
    return (
      <div className="card-glass p-6 animate-pulse">
        <div className="h-8 bg-white/10 rounded w-1/4 mb-4" />
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-12 bg-white/10 rounded" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="card-glass p-6">
      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 border-b border-white/10 pb-1">
        {[
          { id: 'daily', label: 'Daily', count: daily.length },
          { id: 'weekly', label: 'Weekly', count: weekly.length },
          { id: 'monthly', label: 'Monthly', count: monthly.length },
          { id: 'splits', label: 'Driver Splits', count: deposits.length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === tab.id
                ? 'bg-yellow-500 text-gray-900'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label} <span className="ml-1 text-xs opacity-70">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Daily Tab */}
      {activeTab === 'daily' && (
        <div className="space-y-3">
          <div className="grid grid-cols-7 gap-2 text-xs font-semibold text-gray-500 px-2">
            <div>Date</div>
            <div className="text-right">Gross</div>
            <div className="text-right">Fuel</div>
            <div className="text-right">Net</div>
            <div className="text-right">Profit</div>
            <div className="text-right">KM</div>
            <div className="text-right">Shifts</div>
          </div>
          {daily.slice(0, 30).map(day => (
            <div key={day.shift_date} className="grid grid-cols-7 gap-2 text-sm px-2 py-2 bg-white/5 rounded-lg hover:bg-white/10">
              <div className="font-medium">{new Date(day.shift_date).toLocaleDateString('en-ET', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
              <div className="text-right font-mono">{formatBr(day.total_gross)}</div>
              <div className="text-right font-mono text-red-400">-{formatBr(day.total_fuel_cost)}</div>
              <div className="text-right font-mono">{formatBr(day.net_after_fuel_misc)}</div>
              <div className={`text-right font-mono font-bold ${getStatusColor(day.true_profit)}`}>{formatBr(day.true_profit)}</div>
              <div className="text-right font-mono text-gray-400">{formatNum(day.total_km)}</div>
              <div className="text-right text-gray-500">{day.shifts_count}/2</div>
            </div>
          ))}
          {daily.length === 0 && <p className="text-gray-500 text-center py-8">No shifts recorded yet</p>}
        </div>
      )}

      {/* Weekly Tab */}
      {activeTab === 'weekly' && (
        <div className="space-y-3">
          <div className="grid grid-cols-7 gap-2 text-xs font-semibold text-gray-500 px-2">
            <div>Week</div>
            <div className="text-right">Gross</div>
            <div className="text-right">Fuel</div>
            <div className="text-right">Net</div>
            <div className="text-right">Profit</div>
            <div className="text-right">KM</div>
            <div className="text-right">Days</div>
          </div>
          {weekly.map(w => (
            <div key={w.week_start} className="grid grid-cols-7 gap-2 text-sm px-2 py-2 bg-white/5 rounded-lg hover:bg-white/10">
              <div className="font-medium">
                {new Date(w.week_start).toLocaleDateString('en-ET', { month: 'short', day: 'numeric' })}
                {' '}–{' '}
                {new Date(w.week_end).toLocaleDateString('en-ET', { day: 'numeric' })}
              </div>
              <div className="text-right font-mono">{formatBr(w.week_gross)}</div>
              <div className="text-right font-mono text-red-400">-{formatBr(w.week_fuel)}</div>
              <div className="text-right font-mono">{formatBr(w.week_net_after_fuel_misc)}</div>
              <div className={`text-right font-mono font-bold ${getStatusColor(w.week_true_profit / Math.max(w.operating_days, 1))}`}>{formatBr(w.week_true_profit)}</div>
              <div className="text-right font-mono text-gray-400">{formatNum(w.week_km)}</div>
              <div className="text-right text-gray-500">{w.operating_days}/7</div>
            </div>
          ))}
        </div>
      )}

      {/* Monthly Tab */}
      {activeTab === 'monthly' && (
        <div className="space-y-3">
          <div className="grid grid-cols-7 gap-2 text-xs font-semibold text-gray-500 px-2">
            <div>Month</div>
            <div className="text-right">Gross</div>
            <div className="text-right">Fuel</div>
            <div className="text-right">Net</div>
            <div className="text-right">Profit</div>
            <div className="text-right">KM</div>
            <div className="text-right">Days</div>
          </div>
          {monthly.map(m => (
            <div key={m.month_start} className="grid grid-cols-7 gap-2 text-sm px-2 py-3 bg-white/5 rounded-lg hover:bg-white/10 border border-white/5">
              <div className="font-bold gradient-gold">
                {new Date(m.month_start).toLocaleDateString('en-ET', { month: 'long', year: 'numeric' })}
              </div>
              <div className="text-right font-mono text-lg">{formatBr(m.month_gross)}</div>
              <div className="text-right font-mono text-red-400">-{formatBr(m.month_fuel)}</div>
              <div className="text-right font-mono">{formatBr(m.month_net_after_fuel_misc)}</div>
              <div className={`text-right font-mono font-bold text-lg ${getStatusColor(m.month_true_profit / Math.max(m.operating_days, 1))}`}>{formatBr(m.month_true_profit)}</div>
              <div className="text-right font-mono text-gray-400">{formatNum(m.month_km)}</div>
              <div className="text-right text-gray-500">{m.operating_days}/30</div>
            </div>
          ))}
          {monthly.length === 0 && <p className="text-gray-500 text-center py-8">No monthly data yet</p>}
        </div>
      )}

      {/* Splits Tab */}
      {activeTab === 'splits' && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid sm:grid-cols-2 gap-4">
            {Array.from(new Set(deposits.map(d => d.driver_name))).map(name => {
              const driverDeposits = deposits.filter(d => d.driver_name === name)
              const totalDeposit = driverDeposits.reduce((sum, d) => sum + d.full_deposit, 0)
              const totalGross = driverDeposits.reduce((sum, d) => sum + d.gross_br, 0)
              const totalFuel = driverDeposits.reduce((sum, d) => sum + d.fuel_br, 0)
              const totalKm = driverDeposits.reduce((sum, d) => sum + d.kilometers, 0)
              const avgDeposit = driverDeposits.length ? totalDeposit / driverDeposits.length : 0
              return (
                <div key={name} className="card-glass p-4 border border-yellow-500/20">
                  <h4 className="font-bold gradient-gold mb-3">{name}</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-gray-400">Shifts</div>
                    <div className="font-mono text-right">{driverDeposits.length}</div>
                    <div className="text-gray-400">Total Gross</div>
                    <div className="font-mono text-right">{formatBr(totalGross)}</div>
                    <div className="text-gray-400">Total Fuel</div>
                    <div className="font-mono text-right text-red-400">-{formatBr(totalFuel)}</div>
                    <div className="text-gray-400">Total KM</div>
                    <div className="font-mono text-right">{formatNum(totalKm)}</div>
                    <div className="text-gray-400">Avg Deposit/Day</div>
                    <div className="font-mono text-right font-bold text-green-400">{formatBr(avgDeposit)}</div>
                    <div className="text-gray-400">Total Deposit</div>
                    <div className="font-mono text-right font-bold">{formatBr(totalDeposit)}</div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Detailed table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-gray-500 border-b border-white/10">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Driver</th>
                  <th className="pb-2 text-right">Gross</th>
                  <th className="pb-2 text-right">Fuel</th>
                  <th className="pb-2 text-right">KM</th>
                  <th className="pb-2 text-right">Deposit</th>
                </tr>
              </thead>
              <tbody>
                {deposits.slice(0, 60).map(d => (
                  <tr key={d.shift_id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-2">{new Date(d.shift_date).toLocaleDateString('en-ET', { month: 'short', day: 'numeric' })}</td>
                    <td className="py-2 font-medium">{d.driver_name}</td>
                    <td className="py-2 text-right font-mono">{formatBr(d.gross_br)}</td>
                    <td className="py-2 text-right font-mono text-red-400">-{formatBr(d.fuel_br)}</td>
                    <td className="py-2 text-right font-mono text-gray-400">{formatNum(d.kilometers)}</td>
                    <td className="py-2 text-right font-mono font-bold text-green-400">{formatBr2(d.full_deposit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}