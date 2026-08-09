'use client'

import { useEffect, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { useRouter, useSearchParams } from 'next/navigation'
import { SUBSCRIPTION_TIERS } from '@/types/subscription'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export default function CheckoutPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tier = searchParams.get('tier') as keyof typeof SUBSCRIPTION_TIERS || 'pro'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const checkout = async () => {
      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tier }),
        })
        const { sessionId, error: apiError } = await res.json()
        if (apiError) throw new Error(apiError)

        const stripe = await stripePromise
        if (!stripe) throw new Error('Stripe failed to load')

        const { error: stripeError } = await stripe.redirectToCheckout({ sessionId })
        if (stripeError) throw stripeError
      } catch (err: any) {
        setError(err.message)
        setLoading(false)
      }
    }
    checkout()
  }, [tier])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card-glass p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-yellow-500 border-t-transparent mx-auto mb-4" />
          <p className="text-gray-300">Redirecting to Stripe Checkout...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md card-glass p-8 text-center">
        <div className="text-red-400 mb-4">⚠️</div>
        <h1 className="text-2xl font-bold mb-2">Checkout Failed</h1>
        <p className="text-gray-400 mb-6">{error}</p>
        <button 
          onClick={() => router.back()}
          className="btn-secondary"
        >
          Go Back
        </button>
      </div>
    </div>
  )
}