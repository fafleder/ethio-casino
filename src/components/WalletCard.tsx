'use client'

import { useState, useEffect } from 'react'
import { getWallet, getTransactions, createDepositIntent, confirmDeposit, requestWithdrawal } from '@/lib/wallet'
import { loadStripe } from '@stripe/stripe-js'
import { WalletProfile, Transaction } from '@/types/wallet'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export function WalletCard() {
  const [wallet, setWallet] = useState<WalletProfile | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [depositAmount, setDepositAmount] = useState('20')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [depositLoading, setDepositLoading] = useState(false)
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [w, t] = await Promise.all([getWallet(), getTransactions()])
    setWallet(w)
    setTransactions(t)
    setLoading(false)
  }

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) < 1) return
    setDepositLoading(true)
    setError('')
    setSuccess('')

    try {
      const { clientSecret, error: intentError } = await createDepositIntent(parseFloat(depositAmount))
      if (intentError) throw new Error(intentError)

      const stripe = await stripePromise
      if (!stripe) throw new Error('Stripe failed to load')

      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: undefined, billing_details: { name: wallet?.email } },
      })

      if (confirmError) throw new Error(confirmError.message)
      if (paymentIntent?.status === 'succeeded') {
        setSuccess(`Deposited $${depositAmount}!`)
        loadData()
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setDepositLoading(false)
    }
  }

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) < 1) return
    if (!wallet || parseFloat(withdrawAmount) > wallet.wallet_balance) {
      setError('Insufficient balance')
      return
    }
    setWithdrawLoading(true)
    setError('')
    setSuccess('')

    try {
      const { status, error: withdrawError } = await requestWithdrawal(parseFloat(withdrawAmount))
      if (withdrawError) throw new Error(withdrawError)

      setSuccess(`Withdrawal of $${withdrawAmount} requested (${status})`)
      setWithdrawAmount('')
      loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setWithdrawLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="card-glass p-6 animate-pulse">
        <div className="h-8 bg-white/10 rounded w-1/4 mb-4" />
        <div className="h-12 bg-white/10 rounded w-1/2" />
      </div>
    )
  }

  if (!wallet) return null

  return (
    <div className="card-glass p-6">
      <h3 className="text-lg font-bold mb-4 gradient-gold">Wallet</h3>
      
      {/* Balance Display */}
      <div className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
        <div className="text-gray-500 text-sm mb-1">Available Balance</div>
        <div className="text-3xl font-bold gradient-gold">${wallet.wallet_balance.toFixed(2)}</div>
        <div className="text-gray-500 text-sm mt-1">Tier: {wallet.subscription_tier.toUpperCase()}</div>
      </div>

      {/* Deposit Section */}
      <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
        <h4 className="font-semibold text-green-400 mb-3">Add Funds</h4>
        <div className="flex gap-2 mb-3">
          <input
            type="number"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            min="1"
            max="10000"
            step="1"
            className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
            placeholder="Amount (USD)"
          />
          <button
            onClick={handleDeposit}
            disabled={depositLoading}
            className="btn-primary px-6 disabled:opacity-50"
          >
            {depositLoading ? 'Processing...' : 'Deposit'}
          </button>
        </div>
        <div className="flex gap-4 text-sm">
          {['10', '20', '50', '100'].map((amt) => (
            <button
              key={amt}
              onClick={() => setDepositAmount(amt)}
              className="text-gray-400 hover:text-yellow-400 transition"
            >
              ${amt}
            </button>
          ))}
        </div>
      </div>

      {/* Withdraw Section */}
      <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
        <h4 className="font-semibold text-blue-400 mb-3">Withdraw</h4>
        <div className="flex gap-2 mb-3">
          <input
            type="number"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            min="1"
            max={wallet.wallet_balance}
            step="0.01"
            className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
            placeholder="Amount (USD)"
          />
          <button
            onClick={handleWithdraw}
            disabled={withdrawLoading || wallet.wallet_balance <= 0}
            className="btn-secondary px-6 disabled:opacity-50"
          >
            {withdrawLoading ? 'Processing...' : 'Withdraw'}
          </button>
        </div>
        <p className="text-gray-500 text-sm">Min: $1.00 • Instant to your card</p>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-300 text-sm">
          {success}
        </div>
      )}

      {/* Transaction History */}
      <div>
        <h4 className="font-semibold mb-3">Recent Transactions</h4>
        {transactions.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No transactions yet</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    tx.type === 'deposit' || tx.type === 'win' || tx.type === 'cashback' || tx.type === 'bonus'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {tx.type === 'deposit' ? '+' : tx.type === 'win' ? '★' : tx.type === 'withdrawal' ? '-' : '🎲'}
                  </div>
                  <div>
                    <div className="font-medium capitalize">{tx.type}</div>
                    <div className="text-gray-500 text-xs">{new Date(tx.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${tx.type === 'deposit' || tx.type === 'win' || tx.type === 'cashback' || tx.type === 'bonus' ? 'text-green-400' : 'text-red-400'}`}>
                    {tx.type === 'deposit' || tx.type === 'win' || tx.type === 'cashback' || tx.type === 'bonus' ? '+' : '-'}$${tx.amount.toFixed(2)}
                  </div>
                  <div className="text-gray-500 text-xs">${tx.balance_after.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}