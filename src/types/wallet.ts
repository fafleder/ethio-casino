export type Transaction = {
  id: string
  user_id: string
  type: 'deposit' | 'withdrawal' | 'bet' | 'win' | 'cashback' | 'bonus'
  amount: number
  balance_before: number
  balance_after: number
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  stripe_id: string | null
  game_id: string | null
  bet_id: string | null
  metadata: Record<string, any> | null
  created_at: string
}

export type WalletProfile = {
  id: string
  email: string
  subscription_tier: SubscriptionTier
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  wallet_balance: number
  created_at: string
  updated_at: string
}