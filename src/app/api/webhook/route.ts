import { stripe } from '@/lib/stripe'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  let event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  switch (event.type) {
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object
      const customerId = subscription.customer as string
      
      // Find user by stripe_customer_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single()

      if (profile) {
        let tier: keyof typeof import('@/types/subscription').SUBSCRIPTION_TIERS = 'free'
        
        if (event.type === 'customer.subscription.updated' && subscription.status === 'active') {
          // Determine tier from price ID
          const priceId = subscription.items.data[0]?.price.id
          if (priceId === process.env.STRIPE_PRO_PRICE_ID) tier = 'pro'
          else if (priceId === process.env.STRIPE_VIP_PRICE_ID) tier = 'vip'
        }

        await supabase
          .from('profiles')
          .update({
            subscription_tier: tier,
            stripe_subscription_id: subscription.id,
          })
          .eq('id', profile.id)
      }
      break
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object
      const customerId = invoice.customer as string
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single()

      if (profile) {
        // Could send notification email here
        console.log(`Payment failed for user ${profile.id}`)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}