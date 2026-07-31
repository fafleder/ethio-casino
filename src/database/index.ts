import { Pool, PoolClient, QueryResult as PgQueryResult } from 'pg';
import { config } from '../config/index.js';

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  command: string;
  oid: number;
  fields: any[];
}

let pool: Pool | null = null;

export async function initDatabase(): Promise<void> {
  if (pool) return;

  pool = new Pool({
    connectionString: config.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,  // Increased timeout
    ssl: { rejectUnauthorized: false },  // Always use SSL for Neon
  });

  pool.on('error', (err) => {
    console.error('🐘 PostgreSQL pool error:', err);
  });

  // Test connection
  const client = await pool.connect();
  client.release();
  console.log('🐘 Connected to PostgreSQL');
}

export async function query(text: string, params?: any[]): Promise<QueryResult<any>> {
  if (!pool) await initDatabase();
  const start = Date.now();
  try {
    const result = await pool!.query(text, params);
    const duration = Date.now() - start;
    if (config.LOG_LEVEL === 'debug') {
      console.log('📊 Query', { text: text.substring(0, 100), duration, rows: result.rowCount });
    }
    return {
      rows: result.rows as any[],
      rowCount: result.rowCount ?? 0,
      command: result.command,
      oid: result.oid ?? 0,
      fields: result.fields,
    };
  } catch (error) {
    console.error('❌ Query error:', error, { text: text.substring(0, 200), params });
    throw error;
  }
}

export async function getClient(): Promise<PoolClient> {
  if (!pool) await initDatabase();
  return pool!.connect();
}

export async function initSchema(): Promise<void> {
  if (!pool) await initDatabase();

  const schema = `
    CREATE EXTENSION IF NOT EXISTS vector;

    CREATE TABLE IF NOT EXISTS users (
      id BIGINT PRIMARY KEY,
      username VARCHAR(255),
      first_name VARCHAR(255),
      last_name VARCHAR(255),
      language_code VARCHAR(10) DEFAULT 'en',
      balance BIGINT DEFAULT 10000,
      total_wagered BIGINT DEFAULT 0,
      total_won BIGINT DEFAULT 0,
      games_played INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      is_banned BOOLEAN DEFAULT FALSE,
      is_admin BOOLEAN DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS games (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      min_bet BIGINT DEFAULT 100,
      max_bet BIGINT DEFAULT 1000000,
      house_edge DECIMAL(5,4) DEFAULT 0.05,
      rtp DECIMAL(5,4) DEFAULT 0.95,
      is_active BOOLEAN DEFAULT TRUE,
      config JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS game_sessions (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT REFERENCES users(id),
      game_id VARCHAR(50) REFERENCES games(id),
      bet_amount BIGINT NOT NULL,
      result JSONB NOT NULL,
      payout BIGINT NOT NULL,
      is_win BOOLEAN NOT NULL,
      server_seed VARCHAR(64),
      client_seed VARCHAR(64),
      nonce BIGINT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT REFERENCES users(id),
      type VARCHAR(20) NOT NULL,
      amount BIGINT NOT NULL,
      balance_before BIGINT NOT NULL,
      balance_after BIGINT NOT NULL,
      game_session_id BIGINT REFERENCES game_sessions(id),
      description TEXT,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS daily_stats (
      id BIGSERIAL PRIMARY KEY,
      date DATE NOT NULL UNIQUE,
      total_users INT DEFAULT 0,
      active_users INT DEFAULT 0,
      new_users INT DEFAULT 0,
      total_bets BIGINT DEFAULT 0,
      total_wins BIGINT DEFAULT 0,
      total_wagered BIGINT DEFAULT 0,
      total_payout BIGINT DEFAULT 0,
      house_profit BIGINT DEFAULT 0,
      games_played INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS server_seeds (
      id BIGSERIAL PRIMARY KEY,
      seed_hash VARCHAR(64) NOT NULL UNIQUE,
      seed VARCHAR(64) NOT NULL,
      revealed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_game_sessions_user_id ON game_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_game_sessions_game_id ON game_sessions(game_id);
    CREATE INDEX IF NOT EXISTS idx_game_sessions_created_at ON game_sessions(created_at);
    CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
    CREATE INDEX IF NOT EXISTS idx_users_balance ON users(balance);
    CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);

    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ language 'plpgsql';

    DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    INSERT INTO games (id, name, description, min_bet, max_bet, house_edge, rtp, config) VALUES
    ('dice', 'Dice', 'Classic dice game - roll under/over a target', 100, 1000000, 0.01, 0.99, '{"multiplier_range": [1.01, 9900]}'),
    ('coinflip', 'Coin Flip', 'Simple 50/50 coin flip', 100, 500000, 0.02, 0.98, '{}'),
    ('slots', 'Slots', 'Classic 3-reel slot machine', 100, 200000, 0.05, 0.95, '{"reels": 3, "symbols": ["🍒", "🍋", "🍊", "🍇", "⭐", "7️⃣"]}'),
    ('crash', 'Crash', 'Multiplier crashes at random - cash out before it crashes!', 100, 500000, 0.03, 0.97, '{"max_multiplier": 1000, "crash_rate": 0.03}'),
    ('plinko', 'Plinko', 'Drop the ball through pegs to win multipliers', 100, 500000, 0.04, 0.96, '{"rows": 16, "risk_levels": ["low", "medium", "high"]}'),
    ('mines', 'Mines', 'Click tiles to reveal gems, avoid mines!', 100, 500000, 0.03, 0.97, '{"grid_size": 5, "max_mines": 24}')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO users (id, username, first_name, is_admin, balance)
    VALUES (361695664, 'faisel_admin', 'Faisel', TRUE, 100000000)
    ON CONFLICT (id) DO NOTHING;
  `;

  await pool!.query(schema);
  console.log('✅ Database schema initialized');
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('🐘 PostgreSQL pool closed');
  }
}