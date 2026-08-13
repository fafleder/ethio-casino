import { createServerSupabaseClient } from '@/lib/supabase-server'
import { stripe } from '@/lib/stripe'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { amount, paymentMethodId } = await request.json()
    
    if (!amount || amount < 1) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', session.user.id)
      .single()

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ error: 'No payment method' }, { status: 400 })
    }

    // Create and confirm Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      customer: profile.stripe_customer_id,
      payment_method: paymentMethodId,
      confirm: true,
      metadata: { user_id: session.user.id, type: 'deposit' },
    })

    if (paymentIntent.status === 'succeeded') {
      // Add funds to wallet
      await supabase.rpc('add_wallet_balance', { 
        user_id: session.user.id, 
        amount: amount 
      })
    }

    return NextResponse.json({ 
      status: paymentIntent.status,
      clientSecret: paymentIntent.client_secret,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}