'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import { SUBSCRIPTION_TIERS, type UserProfile } from '@/types/subscription'
import Link from 'next/link'
import { WalletCard } from '@/components/WalletCard'
import { ShiftForm } from '@/components/ShiftForm'
import { BusinessReports } from '@/components/BusinessReports'

type Tab = 'overview' | 'shifts' | 'reports' | 'wallet'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth')
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (data) {
        setProfile(data)
      }
      setLoading(false)
    }
    loadProfile()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadProfile()
    })

    return () => subscription.unsubscribe()
  }, [router, supabase])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-yellow-500 border-t-transparent" />
      </div>
    )
  }

  if (!profile) {
    return null
  }

  const tier = SUBSCRIPTION_TIERS[profile.subscription_tier]
  const isFree = profile.subscription_tier === 'free'

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'shifts', label: 'Log Shift', icon: '🚗' },
    { id: 'reports', label: 'Reports', icon: '📈' },
    { id: 'wallet', label: 'Wallet', icon: '💰' },
  ]

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🎰</span>
              <span className="font-bold text-xl gradient-gold">Ethio Casino</span>
            </Link>
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${
              isFree ? 'bg-gray-700 text-gray-300' : 'bg-yellow-500 text-gray-900'
            }`}>
              {tier.name}
            </span>
          </div>
          <button 
            onClick={() => supabase.auth.signOut().then(() => router.push('/'))}
            className="btn-secondary text-sm"
          >
            Sign Out
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6 border-b border-white/10 pb-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-yellow-500 text-gray-900'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Subscription Card */}
            <div className="card-glass p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div>
                  <h2 className="text-2xl font-bold mb-1">Current Plan: <span className="gradient-gold">{tier.name}</span></h2>
                  <p className="text-gray-400">{isFree ? 'Upgrade to unlock unlimited play and withdrawals' : 'Enjoy all your benefits!'}</p>
                </div>
                {isFree && (
                  <div className="flex gap-4">
                    <Link href="/checkout?tier=pro" className="btn-primary">Upgrade to Pro</Link>
                    <Link href="/checkout?tier=vip" className="btn-secondary">Go VIP</Link>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Stats - placeholder until shifts exist */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="card-glass p-6 text-center">
                <div className="text-3xl font-bold gradient-gold">—</div>
                <div className="text-gray-500 text-sm">Today's Gross</div>
              </div>
              <div className="card-glass p-6 text-center">
                <div className="text-3xl font-bold text-green-400">—</div>
                <div className="text-gray-500 text-sm">Your Deposit</div>
              </div>
              <div className="card-glass p-6 text-center">
                <div className="text-3xl font-bold text-yellow-400">—</div>
                <div className="text-gray-500 text-sm">30-Day Avg Profit</div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card-glass p-6">
              <h3 className="text-lg font-bold mb-4 gradient-gold">Quick Actions</h3>
              <div className="flex flex-wrap gap-4">
                <a href="https://t.me/ethioaugames_bot" target="_blank" className="btn-primary">
                  🎮 Play Now on Telegram
                </a>
                {!isFree && (
                  <a href="/api/billing/portal" className="btn-secondary">
                    💳 Manage Billing
                  </a>
                )}
                <a href="https://t.me/ethioaugames_support" target="_blank" className="btn-secondary">
                  💬 Contact Support
                </a>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'shifts' && <ShiftForm />}

        {activeTab === 'reports' && <BusinessReports />}

        {activeTab === 'wallet' && <WalletCard />}
      </div>
    </div>
  )
}