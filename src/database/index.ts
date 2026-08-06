import { Pool, PoolClient, QueryResult as PgQueryResult } from 'pg';
import { config } from '../config/index.js';
import * as fs from 'fs';
import * as path from 'path';

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  command: string;
  oid: number;
  fields: any[];
}

let pool: Pool | null = null;
let sqliteDb: any = null;
let useSqlite = false;

function initSqlite(): any {
  try {
    const Database = require('better-sqlite3');
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = path.join(dataDir, 'casino.db');
    sqliteDb = new Database(dbPath);
    sqliteDb.pragma('journal_mode = WAL');
    console.log('🗄️ SQLite database initialized:', dbPath);
    return sqliteDb;
  } catch (error) {
    console.warn('⚠️ better-sqlite3 not available, using in-memory fallback');
    // In-memory fallback
    const Database = require('better-sqlite3');
    sqliteDb = new Database(':memory:');
    sqliteDb.pragma('journal_mode = WAL');
    return sqliteDb;
  }
}

function runSqliteQuery(text: string, params: any[] = []): QueryResult<any> {
  if (!sqliteDb) initSqlite();
  
  // Convert PostgreSQL $1, $2 placeholders to SQLite ? placeholders
  let paramIndex = 0;
  const sqliteText = text.replace(/\$(\d+)/g, () => {
    paramIndex++;
    return '?';
  });
  
  const isSelect = sqliteText.trim().toUpperCase().startsWith('SELECT');
  
  if (isSelect) {
    const stmt = sqliteDb.prepare(sqliteText);
    const rows = stmt.all(...params);
    return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] };
  } else {
    const stmt = sqliteDb.prepare(sqliteText);
    const result = stmt.run(...params);
    return { rows: [], rowCount: result.changes, command: 'EXECUTE', oid: result.lastInsertRowid, fields: [] };
  }
}

function initPostgresPool(): Pool {
  return new Pool({
    connectionString: config.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false },
  });
}

export async function initDatabase(): Promise<void> {
  if (pool || sqliteDb) return;

  // Try PostgreSQL first (production)
  if (config.DATABASE_URL && config.DATABASE_URL.startsWith('postgresql://')) {
    try {
      pool = initPostgresPool();
      pool.on('error', (err) => {
        console.error('🐘 PostgreSQL pool error:', err);
      });
      
      // Test connection with timeout
      const client: any = await Promise.race([
        pool.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 5000))
      ]);
      client.release();
      console.log('🐘 Connected to PostgreSQL');
      useSqlite = false;
      return;
    } catch (error: any) {
      console.warn('⚠️ PostgreSQL connection failed, falling back to SQLite:', error.message);
      pool = null;
    }
  }

  // Fallback to SQLite for local development
  console.log('🔄 Using SQLite for local development');
  initSqlite();
  useSqlite = true;
  
  // Run schema initialization for SQLite
  await initSqliteSchema();
}

async function initSqliteSchema(): Promise<void> {
  if (!sqliteDb) initSqlite();
  
  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      language_code TEXT DEFAULT 'en',
      balance INTEGER DEFAULT 10000,
      total_wagered INTEGER DEFAULT 0,
      total_won INTEGER DEFAULT 0,
      games_played INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_banned INTEGER DEFAULT 0,
      is_admin INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      min_bet INTEGER DEFAULT 100,
      max_bet INTEGER DEFAULT 1000000,
      house_edge REAL DEFAULT 0.05,
      rtp REAL DEFAULT 0.95,
      is_active INTEGER DEFAULT 1,
      config TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS game_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      game_id TEXT REFERENCES games(id),
      bet_amount INTEGER NOT NULL,
      result TEXT NOT NULL,
      payout INTEGER NOT NULL,
      is_win INTEGER NOT NULL,
      server_seed TEXT,
      client_seed TEXT,
      nonce INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance_before INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      game_session_id INTEGER REFERENCES game_sessions(id),
      description TEXT,
      metadata TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS daily_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATE NOT NULL UNIQUE,
      total_users INTEGER DEFAULT 0,
      active_users INTEGER DEFAULT 0,
      new_users INTEGER DEFAULT 0,
      total_bets INTEGER DEFAULT 0,
      total_wins INTEGER DEFAULT 0,
      total_wagered INTEGER DEFAULT 0,
      total_payout INTEGER DEFAULT 0,
      house_profit INTEGER DEFAULT 0,
      games_played INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS server_seeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seed_hash TEXT NOT NULL UNIQUE,
      seed TEXT NOT NULL,
      revealed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_game_sessions_user_id ON game_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_game_sessions_game_id ON game_sessions(game_id);
    CREATE INDEX IF NOT EXISTS idx_game_sessions_created_at ON game_sessions(created_at);
    CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
    CREATE INDEX IF NOT EXISTS idx_users_balance ON users(balance);
    CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);

    INSERT OR IGNORE INTO games (id, name, description, min_bet, max_bet, house_edge, rtp, config) VALUES
    ('dice', 'Dice', 'Classic dice game - roll under/over a target', 100, 1000000, 0.01, 0.99, '{"multiplier_range": [1.01, 9900]}'),
    ('coinflip', 'Coin Flip', 'Simple 50/50 coin flip', 100, 500000, 0.02, 0.98, '{}'),
    ('slots', 'Slots', 'Classic 3-reel slot machine', 100, 200000, 0.05, 0.95, '{"reels": 3, "symbols": ["🍒", "🍋", "🍊", "🍇", "⭐", "7️⃣"]}'),
    ('crash', 'Crash', 'Multiplier crashes at random - cash out before it crashes!', 100, 500000, 0.03, 0.97, '{"max_multiplier": 1000, "crash_rate": 0.03}'),
    ('plinko', 'Plinko', 'Drop the ball through pegs to win multipliers', 100, 500000, 0.04, 0.96, '{"rows": 16, "risk_levels": ["low", "medium", "high"]}'),
    ('mines', 'Mines', 'Click tiles to reveal gems, avoid mines!', 100, 500000, 0.03, 0.97, '{"grid_size": 5, "max_mines": 24}');

    INSERT OR IGNORE INTO users (id, username, first_name, is_admin, balance)
    VALUES (361695664, 'faisel_admin', 'Faisel', 1, 100000000);
  `;
  
  sqliteDb.exec(schema);
  console.log('✅ SQLite schema initialized');
}

export async function query(text: string, params?: any[]): Promise<QueryResult<any>> {
  await initDatabase();
  const start = Date.now();
  try {
    let result: QueryResult<any>;
    if (useSqlite) {
      result = runSqliteQuery(text, params || []);
    } else {
      const pgResult = await pool!.query(text, params);
      result = {
        rows: pgResult.rows as any[],
        rowCount: pgResult.rowCount ?? 0,
        command: pgResult.command,
        oid: pgResult.oid ?? 0,
        fields: pgResult.fields,
      };
    }
    const duration = Date.now() - start;
    if (config.LOG_LEVEL === 'debug') {
      console.log('📊 Query', { text: text.substring(0, 100), duration, rows: result.rowCount });
    }
    return result;
  } catch (error) {
    console.error('❌ Query error:', error, { text: text.substring(0, 200), params });
    throw error;
  }
}

export async function getClient(): Promise<PoolClient | any> {
  await initDatabase();
  if (useSqlite) {
    // Return a mock client for SQLite
    return {
      query: (text: string, params?: any[]) => runSqliteQuery(text, params || []),
      release: () => {},
    };
  }
  return pool!.connect();
}

export async function initSchema(): Promise<void> {
  await initDatabase();
  
  if (useSqlite) {
    // Schema already initialized in initDatabase for SQLite
    console.log('✅ SQLite schema already initialized');
    return;
  }

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
  console.log('✅ PostgreSQL database schema initialized');
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('🐘 PostgreSQL pool closed');
  }
  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
    console.log('🗄️ SQLite database closed');
  }
}