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

    const { amount } = await request.json()
    
    if (!amount || amount < 1) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('wallet_balance, stripe_customer_id')
      .eq('id', session.user.id)
      .single()

    if (!profile || (profile.wallet_balance || 0) < amount) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 })
    }

    if (!profile.stripe_customer_id) {
      return NextResponse.json({ error: 'No payment method on file' }, { status: 400 })
    }

    // Create payout to customer's default payment method
    const payout = await stripe.payouts.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      method: 'instant',
      metadata: { user_id: session.user.id, type: 'withdrawal' },
    }, {
      stripeAccount: profile.stripe_customer_id, // This would need Connect for real payouts
    })

    // For simplicity, deduct from wallet (real implementation needs Stripe Connect)
    await supabase.rpc('subtract_wallet_balance', { 
      user_id: session.user.id, 
      amount 
    })

    // Log transaction
    await supabase
      .from('transactions')
      .insert({
        user_id: session.user.id,
        type: 'withdrawal',
        amount,
        status: 'pending',
        stripe_id: payout.id,
      })

    return NextResponse.json({ 
      status: 'pending',
      payoutId: payout.id,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}