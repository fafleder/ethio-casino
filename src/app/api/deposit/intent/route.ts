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

    const { amount, currency = 'usd' } = await request.json()
    
    if (!amount || amount < 100) { // minimum $1.00 (100 cents)
      return NextResponse.json({ error: 'Minimum deposit $1.00' }, { status: 400 })
    }

    // Get or create Stripe customer
    let customerId: string | null = null
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', session.user.id)
      .single()

    if (profile?.stripe_customer_id) {
      customerId = profile.stripe_customer_id
    } else {
      const customer = await stripe.customers.create({
        email: session.user.email!,
        name: session.user.user_metadata.full_name,
      })
      customerId = customer.id
      
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', session.user.id)
    }

    // Create Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // convert to cents
      currency,
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: {
        user_id: session.user.id,
        type: 'deposit',
      },
    })

    return NextResponse.json({ 
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    })
  } catch (error: any) {
    console.error('Deposit intent error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}