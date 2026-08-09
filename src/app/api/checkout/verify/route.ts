import { createServerSupabaseClient } from '@/lib/supabase-server'
import { stripe } from '@/lib/stripe'
import { SUBSCRIPTION_TIERS } from '@/types/subscription'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const sessionId = searchParams.get('session_id')

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    })

    if (session.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Payment not completed' }, { status: 400 })
    }

    const userId = session.metadata?.user_id
    const tier = session.metadata?.tier as keyof typeof SUBSCRIPTION_TIERS

    if (!userId || !tier) {
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()
    
    await supabase
      .from('profiles')
      .update({
        subscription_tier: tier,
        stripe_subscription_id: session.subscription as string,
      })
      .eq('id', userId)

    // Generate Telegram deep link
    const telegramUrl = `https://t.me/ethioaugames_bot?start=paid_${userId}`

    return NextResponse.json({ telegramUrl })
  } catch (error: any) {
    console.error('Verify error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}