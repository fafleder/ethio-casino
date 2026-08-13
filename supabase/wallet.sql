-- Wallet balance and transactions for deposits/withdrawals

-- Add wallet_balance to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wallet_balance DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'bet', 'win', 'cashback', 'bonus')),
  amount DECIMAL(12,2) NOT NULL,
  balance_before DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  stripe_id TEXT,
  game_id TEXT,
  bet_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all transactions" ON transactions
  FOR ALL USING (auth.role() = 'service_role');

-- RPC: Add wallet balance atomically
CREATE OR REPLACE FUNCTION add_wallet_balance(user_id UUID, amount DECIMAL(12,2))
RETURNS VOID AS $$
DECLARE
  bal_before DECIMAL(12,2);
  bal_after DECIMAL(12,2);
BEGIN
  UPDATE profiles 
  SET wallet_balance = wallet_balance + amount,
      updated_at = NOW()
  WHERE id = user_id
  RETURNING wallet_balance - amount, wallet_balance INTO bal_before, bal_after;

  INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, status)
  VALUES (user_id, 'deposit', amount, bal_before, bal_after, 'completed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Subtract wallet balance atomically
CREATE OR REPLACE FUNCTION subtract_wallet_balance(user_id UUID, amount DECIMAL(12,2))
RETURNS BOOLEAN AS $$
DECLARE
  bal_before DECIMAL(12,2);
  bal_after DECIMAL(12,2);
BEGIN
  UPDATE profiles 
  SET wallet_balance = wallet_balance - amount,
      updated_at = NOW()
  WHERE id = user_id AND wallet_balance >= amount
  RETURNING wallet_balance + amount, wallet_balance INTO bal_before, bal_after;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, status)
  VALUES (user_id, 'withdrawal', amount, bal_before, bal_after, 'completed');

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Place bet (deduct from wallet)
CREATE OR REPLACE FUNCTION place_bet(user_id UUID, amount DECIMAL(12,2), game_id TEXT, bet_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  bal_before DECIMAL(12,2);
  bal_after DECIMAL(12,2);
BEGIN
  UPDATE profiles 
  SET wallet_balance = wallet_balance - amount,
      updated_at = NOW()
  WHERE id = user_id AND wallet_balance >= amount
  RETURNING wallet_balance + amount, wallet_balance INTO bal_before, bal_after;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, status, game_id, bet_id)
  VALUES (user_id, 'bet', amount, bal_before, bal_after, 'completed', game_id, bet_id);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Process win (add to wallet)
CREATE OR REPLACE FUNCTION process_win(user_id UUID, amount DECIMAL(12,2), game_id TEXT, bet_id TEXT)
RETURNS VOID AS $$
DECLARE
  bal_before DECIMAL(12,2);
  bal_after DECIMAL(12,2);
BEGIN
  UPDATE profiles 
  SET wallet_balance = wallet_balance + amount,
      updated_at = NOW()
  WHERE id = user_id
  RETURNING wallet_balance - amount, wallet_balance INTO bal_before, bal_after;

  INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, status, game_id, bet_id)
  VALUES (user_id, 'win', amount, bal_before, bal_after, 'completed', game_id, bet_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Index for transaction queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);