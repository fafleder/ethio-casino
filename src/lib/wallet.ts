import { createClient } from '@/lib/supabase-client'
import { WalletProfile, Transaction } from '@/types/wallet'

const supabase = createClient()

export async function getWallet(): Promise<WalletProfile | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  return data
}

export async function getTransactions(limit = 50): Promise<Transaction[]> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return []

  const { data } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  return data || []
}

export async function createDepositIntent(amount: number) {
  const res = await fetch('/api/deposit/intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount }),
  })
  return res.json()
}

export async function confirmDeposit(amount: number, paymentMethodId: string) {
  const res = await fetch('/api/deposit/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, paymentMethodId }),
  })
  return res.json()
}

export async function requestWithdrawal(amount: number) {
  const res = await fetch('/api/withdraw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount }),
  })
  return res.json()
}