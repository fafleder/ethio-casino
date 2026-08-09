'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import { SUBSCRIPTION_TIERS, type UserProfile } from '@/types/subscription'
import Link from 'next/link'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="min-h-screen py-20 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
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

        {/* Subscription Card */}
        <div className="card-glass p-8 mb-8">
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

        {/* Benefits */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="card-glass p-6">
            <h3 className="text-lg font-bold mb-4 gradient-gold">Your Benefits</h3>
            <ul className="space-y-2">
              {tier.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-300">
                  <span className="text-yellow-400">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="card-glass p-6">
            <h3 className="text-lg font-bold mb-4 gradient-gold">Limits</h3>
            <dl className="space-y-2 text-gray-300">
              <div className="flex justify-between">
                <dt>Daily Credits</dt>
                <dd className="font-bold">{tier.limits.dailyCredits === -1 ? 'Unlimited' : tier.limits.dailyCredits}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Max Bet</dt>
                <dd className="font-bold">${tier.limits.maxBet}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Withdrawals</dt>
                <dd className="font-bold">{tier.limits.withdrawals ? 'Enabled' : 'Disabled'}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Cashback</dt>
                <dd className="font-bold text-yellow-400">{tier.limits.cashback}%</dd>
              </div>
            </dl>
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
    </div>
  )
}