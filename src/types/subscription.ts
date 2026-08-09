export const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Free',
    price: 0,
    priceId: null,
    features: [
      '100 demo credits/day',
      'All 6 games (Dice, Coin Flip, Slots, Crash, Plinko, Mines)',
      'Provably fair HMAC-SHA256 verification',
      'No withdrawals',
    ],
    limits: {
      dailyCredits: 100,
      maxBet: 10,
      withdrawals: false,
      cashback: 0,
    },
  },
  pro: {
    name: 'Pro',
    price: 9.99,
    priceId: process.env.STRIPE_PRO_PRICE_ID || 'price_pro_monthly',
    features: [
      'Unlimited credits',
      'All 6 games + new releases',
      'Provably fair HMAC-SHA256 verification',
      'Withdrawals enabled',
      '2% cashback on all bets',
      'Priority support',
    ],
    limits: {
      dailyCredits: -1,
      maxBet: 1000,
      withdrawals: true,
      cashback: 2,
    },
  },
  vip: {
    name: 'VIP',
    price: 29.99,
    priceId: process.env.STRIPE_VIP_PRICE_ID || 'price_vip_monthly',
    features: [
      'Unlimited credits',
      'All 6 games + exclusive VIP games',
      'Provably fair HMAC-SHA256 verification',
      'Higher bet limits',
      '5% cashback on all bets',
      '24/7 priority support',
      'Personal account manager',
      'Early access to new features',
    ],
    limits: {
      dailyCredits: -1,
      maxBet: 10000,
      withdrawals: true,
      cashback: 5,
    },
  },
} as const

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS
export type UserProfile = {
  id: string
  email: string
  subscription_tier: SubscriptionTier
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  created_at: string
  updated_at: string
}