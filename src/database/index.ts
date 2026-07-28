import { config } from '../config';

type QueryResult<T = any> = { rows: T[]; rowCount: number };

// Check if we're using SQLite (local) or PostgreSQL (production)
const isSQLite = config.DATABASE_URL.startsWith('sqlite:') || config.DATABASE_URL.endsWith('.db');
const isPostgres = config.DATABASE_URL.startsWith('postgresql:') || config.DATABASE_URL.startsWith('postgres:');

let db: any = null;
let dbType: 'sqlite' | 'postgres' | 'memory' = 'sqlite';

export async function initDatabase() {
  if (isPostgres) {
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: config.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
    db = pool;
    dbType = 'postgres';
    console.log('🐘 Connected to PostgreSQL');
  } else {
    // Use better-sqlite3 for local development (dynamic import)
    try {
      // @ts-ignore - better-sqlite3 may not be installed in dev environment
      const Database = (await import('better-sqlite3')).default;
      const dbPath = config.DATABASE_URL.replace('sqlite:', '');
      const sqlite = new Database(dbPath);
      
      // Enable WAL mode for better concurrency
      sqlite.pragma('journal_mode = WAL');
      sqlite.pragma('foreign_keys = ON');
      
      db = sqlite;
      dbType = 'sqlite';
      console.log('🗄️  Connected to SQLite:', dbPath);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn('⚠️  better-sqlite3 not available (needs Visual Studio build tools), using in-memory store:', errorMessage);
      db = createMemoryStore();
      dbType = 'memory';
    }
  }
}

function createMemoryStore() {
  // Simple in-memory store using plain objects
  const tables: Record<string, Record<string, any>> = {
    users: {},
    games: {},
    game_sessions: {},
    transactions: {},
    daily_stats: {},
    server_seeds: {},
  };
  
  // Seed default games
  const defaultGames = [
    { id: 'dice', name: 'Dice', description: 'Classic dice game - roll under/over a target', min_bet: 100, max_bet: 1000000, house_edge: 0.01, rtp: 0.99, is_active: true, config: '{"multiplier_range": [1.01, 9900]}', created_at: new Date().toISOString() },
    { id: 'coinflip', name: 'Coin Flip', description: 'Simple 50/50 coin flip', min_bet: 100, max_bet: 500000, house_edge: 0.02, rtp: 0.98, is_active: true, config: '{}', created_at: new Date().toISOString() },
    { id: 'slots', name: 'Slots', description: 'Classic 3-reel slot machine', min_bet: 100, max_bet: 200000, house_edge: 0.05, rtp: 0.95, is_active: true, config: '{"reels": 3, "symbols": ["🍒", "🍋", "🍊", "🍇", "⭐", "7️⃣"]}', created_at: new Date().toISOString() },
    { id: 'crash', name: 'Crash', description: 'Multiplier crashes at random - cash out before it crashes!', min_bet: 100, max_bet: 500000, house_edge: 0.03, rtp: 0.97, is_active: true, config: '{"max_multiplier": 1000, "crash_rate": 0.03}', created_at: new Date().toISOString() },
    { id: 'plinko', name: 'Plinko', description: 'Drop the ball through pegs to win multipliers', min_bet: 100, max_bet: 500000, house_edge: 0.04, rtp: 0.96, is_active: true, config: '{"rows": 16, "risk_levels": ["low", "medium", "high"]}', created_at: new Date().toISOString() },
    { id: 'mines', name: 'Mines', description: 'Click tiles to reveal gems, avoid mines!', min_bet: 100, max_bet: 500000, house_edge: 0.03, rtp: 0.97, is_active: true, config: '{"grid_size": 5, "max_mines": 24}', created_at: new Date().toISOString() },
  ];
  
  defaultGames.forEach(g => {
    tables.games[g.id] = g;
  });
  
  // Seed admin user
  tables.users['361695664'] = {
    id: 361695664,
    username: 'faisel_admin',
    first_name: 'Faisel',
    last_name: '',
    language_code: 'en',
    balance: 100000000,
    total_wagered: 0,
    total_won: 0,
    games_played: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_banned: false,
    is_admin: true,
  };
  
  function getTable(name: string): Record<string, any> {
    if (!tables[name]) tables[name] = {};
    return tables[name];
  }
  
  function parseQuery(text: string) {
    const lower = text.toLowerCase().trim();
    return {
      isSelect: lower.startsWith('select'),
      isInsert: lower.startsWith('insert'),
      isUpdate: lower.startsWith('update'),
      isDelete: lower.startsWith('delete'),
      tableMatch: text.match(/(?:from|into|update|delete from)\s+(\w+)/i),
      whereMatch: text.match(/where\s+(.+?)(?:\s+(?:order|limit|group|$))/i),
      returningMatch: text.match(/returning\s+\*/i),
      onConflictMatch: text.match(/on conflict\s*\(([^)]+)\)\s+do\s+(?:update|nothing)/i),
      setMatch: text.match(/set\s+(.+?)(?:\s+where|\s+$)/i),
      valuesMatch: text.match(/values\s*\(([^)]+)\)/i),
    };
  }
  
  function evalWhere(row: any, whereClause: string, params: any[]): boolean {
    if (!whereClause) return true;
    try {
      let clause = whereClause
        .replace(/\$(\d+)/g, (_, n) => JSON.stringify(params[parseInt(n) - 1]))
        .replace(/\?/g, () => JSON.stringify(params.shift()));
      
      clause = clause.replace(/(\w+)\s*=\s*/g, (_, col) => `row.${col} === `);
      clause = clause.replace(/(\w+)\s*!=\s*/g, (_, col) => `row.${col} !== `);
      
      // eslint-disable-next-line no-eval
      return eval(`(row) => ${clause}`)(row);
    } catch {
      return true;
    }
  }
  
  function getTableByName(name: string): Record<string, any> | undefined {
    return tables[name];
  }
  
  return {
    query: async (text: string, params: any[] = []): Promise<QueryResult> => {
      console.log('📊 [Memory] Query:', text.substring(0, 100), params);
      
      const parsed = parseQuery(text);
      const tableName = parsed.tableMatch?.[1]?.toLowerCase();
      const table = tableName ? tables[tableName] : undefined;
      
      if (!table) {
        console.warn('Table not found:', tableName);
        return { rows: [], rowCount: 0 };
      }
      
      // SELECT queries
      if (parsed.isSelect) {
        let rows = Object.values(table);
        
        // Apply WHERE
        if (parsed.whereMatch) {
          rows = rows.filter(row => evalWhere(row, parsed.whereMatch![1], [...params]));
        }
        
        // ORDER BY (simple)
        if (text.toLowerCase().includes('order by')) {
          const orderMatch = text.match(/order by\s+(\w+)\s*(desc|asc)?/i);
          if (orderMatch) {
            const col = orderMatch[1];
            const dir = orderMatch[2]?.toLowerCase() === 'desc' ? -1 : 1;
            rows.sort((a: any, b: any) => dir * ((a[col] > b[col]) ? 1 : -1));
          }
        }
        
        // LIMIT
        const limitMatch = text.match(/limit\s+(\d+)/i);
        if (limitMatch) {
          rows = rows.slice(0, parseInt(limitMatch[1]));
        }
        
        // OFFSET
        const offsetMatch = text.match(/offset\s+(\d+)/i);
        if (offsetMatch) {
          rows = rows.slice(parseInt(offsetMatch[1]));
        }
        
        return { rows, rowCount: rows.length };
      }
      
      // INSERT queries - simple version
      if (parsed.isInsert && tableName) {
        const table = tables[tableName];
        if (!table) return { rows: [], rowCount: 0 };
        
        const row: any = {};
        const columns = text.match(/\(([^)]+)\)/)?.[1].split(',').map(c => c.trim()) || [];
        const values = parsed.valuesMatch?.[1].split(',').map(v => v.trim()) || [];
        
        columns.forEach((col, i) => {
          let val = values[i];
          // Replace $1, $2 or ? with params
          val = val.replace(/\$(\d+)/g, (_, n) => String(params[parseInt(n) - 1]));
          val = val.replace(/\?/g, () => String(params.shift()));
          // Clean up
          val = val.replace(/^['"]|['"]$/g, '').trim();
          // Try to parse numbers
          if (!isNaN(Number(val)) && val !== '') val = String(Number(val));
          row[col] = val;
        });
        
        // Handle auto-increment ID
        if (row.id === undefined || row.id === null || row.id === '') {
          const keys = Object.keys(table);
          row.id = keys.length > 0 ? Math.max(...keys.map(k => parseInt(k) || 0)) + 1 : 1;
        }
        
        // Default timestamps
        if (row.created_at === undefined) row.created_at = new Date().toISOString();
        if (row.updated_at === undefined) row.updated_at = new Date().toISOString();
        
        // Handle ON CONFLICT (simplified)
        if (parsed.onConflictMatch) {
          const conflictCol = parsed.onConflictMatch[1].trim();
          const existing = Object.values(table).find((r: any) => r[conflictCol] === row[conflictCol]);
          if (existing) {
            if (text.includes('DO UPDATE')) {
              if (parsed.setMatch) {
                const sets = parsed.setMatch[1].split(',');
                sets.forEach(set => {
                  const [col, val] = set.split('=').map(s => s.trim());
                  let parsedVal = val.replace(/\$(\d+)/g, (_, n) => String(params[parseInt(n) - 1]));
                  parsedVal = parsedVal.replace(/\?/g, () => String(params.shift()));
                  parsedVal = parsedVal.replace(/^['"]|['"]$/g, '').trim();
                  if (!isNaN(Number(parsedVal)) && parsedVal !== '') parsedVal = String(Number(parsedVal));
                  // Handle COALESCE
                  if (parsedVal.toString().toLowerCase().startsWith('coalesce(')) {
                    if (row[col] !== undefined && row[col] !== null && row[col] !== '') {
                      existing[col] = row[col];
                    }
                  } else {
                    existing[col] = parsedVal;
                  }
                });
                existing.updated_at = new Date().toISOString();
              }
            }
            // DO NOTHING - return existing
            if (parsed.returningMatch) return { rows: [existing], rowCount: 1 };
            return { rows: [], rowCount: 0 };
          }
        }
        
        table[row.id] = row;
        if (parsed.returningMatch) return { rows: [row], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      }
      
      // UPDATE queries - simplified
      if (parsed.isUpdate && tableName) {
        const table = tables[tableName];
        if (!table) return { rows: [], rowCount: 0 };
        
        let updated = 0;
        if (parsed.whereMatch) {
          for (const [id, row] of Object.entries(table)) {
            if (evalWhere(row, parsed.whereMatch![1], [...params])) {
              if (parsed.setMatch) {
                const sets = parsed.setMatch[1].split(',');
                sets.forEach(set => {
                  const [col, val] = set.split('=').map(s => s.trim());
                  let parsedVal = val.replace(/\$(\d+)/g, (_, n) => String(params[parseInt(n) - 1]));
                  parsedVal = parsedVal.replace(/\?/g, () => String(params.shift()));
                  parsedVal = parsedVal.replace(/^['"]|['"]$/g, '').trim();
                  // Handle expressions like total_wagered = total_wagered + $1
                  if (parsedVal.includes('+')) {
                    const parts = parsedVal.split('+').map(p => p.trim());
                    const currentVal = table[id][col] || 0;
                    const addVal = parts[1] ? (isNaN(Number(parts[1])) ? params[0] : Number(parts[1])) : 0;
                    table[id][col] = currentVal + addVal;
                  } else {
                    if (!isNaN(Number(parsedVal)) && parsedVal !== '') parsedVal = String(Number(parsedVal));
                    table[id][col] = parsedVal;
                  }
                });
              }
              table[id].updated_at = new Date().toISOString();
              updated++;
            }
          }
        }
        return { rows: [], rowCount: updated };
      }
      
      return { rows: [], rowCount: 0 };
    },
    exec: (sql: string) => {
      console.log('📊 [Memory] Exec:', sql.substring(0, 100));
    },
    prepare: (sql: string) => ({
      run: (...params: any[]) => ({ changes: 0, lastInsertRowid: 0 }),
      get: (...params: any[]) => undefined,
      all: (...params: any[]) => [],
    }),
    close: () => {},
  };
}

export async function query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  if (!db) await initDatabase();
  
  const start = Date.now();
  
  try {
    if (dbType === 'postgres') {
      const res = await db.query(text, params);
      const duration = Date.now() - start;
      if (config.LOG_LEVEL === 'debug') {
        console.log('📊 Query executed', { text: text.substring(0, 100), duration, rows: res.rowCount });
      }
      return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
    } else if (dbType === 'sqlite') {
      // Convert PostgreSQL syntax to SQLite
      let sqliteQuery = text
        .replace(/\$(\d+)/g, '?') // $1, $2 -> ?, ?
        .replace(/BIGSERIAL/g, 'INTEGER PRIMARY KEY AUTOINCREMENT')
        .replace(/BIGINT/g, 'INTEGER')
        .replace(/TIMESTAMPTZ/g, 'TEXT')
        .replace(/JSONB/g, 'TEXT')
        .replace(/ON CONFLICT \(.*?\) DO NOTHING/g, '')
        .replace(/CREATE OR REPLACE FUNCTION.*?EXECUTE FUNCTION update_updated_at_column\(\);/gs, '')
        .replace(/DROP TRIGGER IF EXISTS.*?EXECUTE FUNCTION update_updated_at_column\(\);/gs, '');
      
      const stmt = db.prepare(sqliteQuery);
      const rows = stmt.all(...(params || [])) as T[];
      const duration = Date.now() - start;
      if (config.LOG_LEVEL === 'debug') {
        console.log('📊 Query executed', { text: text.substring(0, 100), duration, rows: rows.length });
      }
      return { rows, rowCount: rows.length };
    } else {
      // Memory store
      return await db.query(text, params);
    }
  } catch (error) {
    console.error('❌ Query error:', error, { text: text.substring(0, 200), params });
    throw error;
  }
}

export async function getClient(): Promise<any> {
  if (!db) await initDatabase();
  
  if (dbType === 'postgres') {
    return db.connect();
  } else if (dbType === 'sqlite') {
    // SQLite doesn't have client pooling, return a transaction wrapper
    return {
      query: async (text: string, params: any[]) => {
        let sqliteQuery = text
          .replace(/\$(\d+)/g, '?')
          .replace(/BIGSERIAL/g, 'INTEGER PRIMARY KEY AUTOINCREMENT')
          .replace(/BIGINT/g, 'INTEGER')
          .replace(/TIMESTAMPTZ/g, 'TEXT')
          .replace(/JSONB/g, 'TEXT');
        const stmt = db.prepare(sqliteQuery);
        const rows = stmt.all(...params);
        return { rows, rowCount: rows.length };
      },
      release: () => {},
    };
  }
  return db;
}

export async function initSchema(): Promise<void> {
  if (!db) await initDatabase();
  
  if (dbType === 'postgres') {
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
    
    await db.query(schema);
  } else if (dbType === 'sqlite') {
    const schema = `
      -- Users table
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
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        is_banned INTEGER DEFAULT 0,
        is_admin INTEGER DEFAULT 0
      );

      -- Games catalog
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
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Game sessions/rounds
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
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Transactions
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
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Daily stats
      CREATE TABLE IF NOT EXISTS daily_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        total_users INTEGER DEFAULT 0,
        active_users INTEGER DEFAULT 0,
        new_users INTEGER DEFAULT 0,
        total_bets INTEGER DEFAULT 0,
        total_wins INTEGER DEFAULT 0,
        total_wagered INTEGER DEFAULT 0,
        total_payout INTEGER DEFAULT 0,
        house_profit INTEGER DEFAULT 0,
        games_played INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Provably fair seeds
      CREATE TABLE IF NOT EXISTS server_seeds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seed_hash TEXT NOT NULL UNIQUE,
        seed TEXT NOT NULL,
        revealed_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_game_sessions_user_id ON game_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_game_sessions_game_id ON game_sessions(game_id);
      CREATE INDEX IF NOT EXISTS idx_game_sessions_created_at ON game_sessions(created_at);
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
      CREATE INDEX IF NOT EXISTS idx_users_balance ON users(balance);
      CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);

      -- Insert default games
      INSERT OR IGNORE INTO games (id, name, description, min_bet, max_bet, house_edge, rtp, config) VALUES
      ('dice', 'Dice', 'Classic dice game - roll under/over a target', 100, 1000000, 0.01, 0.99, '{"multiplier_range": [1.01, 9900]}'),
      ('coinflip', 'Coin Flip', 'Simple 50/50 coin flip', 100, 500000, 0.02, 0.98, '{}'),
      ('slots', 'Slots', 'Classic 3-reel slot machine', 100, 200000, 0.05, 0.95, '{"reels": 3, "symbols": ["🍒", "🍋", "🍊", "🍇", "⭐", "7️⃣"]}'),
      ('crash', 'Crash', 'Multiplier crashes at random - cash out before it crashes!', 100, 500000, 0.03, 0.97, '{"max_multiplier": 1000, "crash_rate": 0.03}'),
      ('plinko', 'Plinko', 'Drop the ball through pegs to win multipliers', 100, 500000, 0.04, 0.96, '{"rows": 16, "risk_levels": ["low", "medium", "high"]}'),
      ('mines', 'Mines', 'Click tiles to reveal gems, avoid mines!', 100, 500000, 0.03, 0.97, '{"grid_size": 5, "max_mines": 24}');

      -- Insert default admin user
      INSERT OR IGNORE INTO users (id, username, first_name, is_admin, balance)
      VALUES (361695664, 'faisel_admin', 'Faisel', 1, 100000000);
    `;
    
    // Execute each statement separately for SQLite
    const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      try {
        db.exec(stmt + ';');
      } catch (e: any) {
        // Ignore duplicate errors
        if (!e.message.includes('already exists') && !e.message.includes('UNIQUE constraint failed')) {
          console.error('Schema error:', e.message, 'Statement:', stmt.substring(0, 100));
        }
      }
    }
  }
  
  console.log('✅ Database schema initialized');
}

export async function closePool(): Promise<void> {
  if (db) {
    if (dbType === 'postgres') {
      await db.end();
    } else if (dbType === 'sqlite') {
      db.close();
    }
  }
}