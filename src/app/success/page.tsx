'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function SuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    const verifyAndRedirect = async () => {
      if (!sessionId) {
        router.push('/dashboard')
        return
      }

      try {
        const res = await fetch(`/api/checkout/verify?session_id=${sessionId}`)
        const data = await res.json()
        
        if (data.telegramUrl) {
          setRedirecting(true)
          window.location.href = data.telegramUrl
        } else {
          router.push('/dashboard')
        }
      } catch {
        router.push('/dashboard')
      }
    }
    verifyAndRedirect()
  }, [sessionId, router])

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md card-glass p-8 text-center">
        {redirecting ? (
          <>
            <div className="text-6xl mb-4 animate-bounce">🎉</div>
            <h1 className="text-3xl font-bold mb-2 gradient-gold">Welcome to Pro!</h1>
            <p className="text-gray-400 mb-6">Redirecting you to Telegram to start playing...</p>
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-yellow-500 border-t-transparent mx-auto" />
          </>
        ) : (
          <>
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-3xl font-bold mb-2">Payment Successful!</h1>
            <p className="text-gray-400 mb-6">Your subscription is now active.</p>
            <Link href="/dashboard" className="btn-primary inline-block">
              Go to Dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  )
}