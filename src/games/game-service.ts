import { query, getClient } from '../database/index.js';
import { ProvablyFairEngine, GameResult } from './provably-fair';
import { randomBytes } from 'crypto';

export interface GameSession {
  id: number;
  user_id: number;
  game_id: string;
  bet_amount: number;
  result: any;
  payout: number;
  is_win: boolean;
  server_seed: string;
  client_seed: string;
  nonce: number;
  created_at: Date;
}

export interface GameConfig {
  id: string;
  name: string;
  description: string;
  min_bet: number;
  max_bet: number;
  house_edge: number;
  rtp: number;
  config: Record<string, any>;
  is_active: boolean;
}

export class GameService {
  private serverSeeds: Map<number, { seed: string; hash: string; revealed: boolean }> = new Map();

  async getGames(): Promise<GameConfig[]> {
    const res = await query('SELECT * FROM games WHERE is_active = TRUE ORDER BY id');
    return res.rows as GameConfig[];
  }

  async getGame(gameId: string): Promise<GameConfig | null> {
    const res = await query('SELECT * FROM games WHERE id = $1 AND is_active = TRUE', [gameId]);
    return (res.rows[0] as GameConfig) || null;
  }

  async getOrCreateUser(userId: number, username?: string, firstName?: string, lastName?: string, languageCode?: string) {
    const res = await query(
      `INSERT INTO users (id, username, first_name, last_name, language_code)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         username = COALESCE($2, users.username),
         first_name = COALESCE($3, users.first_name),
         last_name = COALESCE($4, users.last_name),
         language_code = COALESCE($5, users.language_code)
       RETURNING *`,
      [userId, username, firstName, lastName, languageCode || 'en']
    );
    return res.rows[0];
  }

  async getUserBalance(userId: number): Promise<number> {
    const res = await query('SELECT balance FROM users WHERE id = $1', [userId]);
    return res.rows[0]?.balance || 0;
  }

  async generateServerSeed(userId: number): Promise<string> {
    const seed = randomBytes(32).toString('hex');
    const pfEngine = new ProvablyFairEngine(seed);
    const hash = pfEngine.getServerSeedHash();

    // Store in database
    await query(
      'INSERT INTO server_seeds (seed_hash, seed) VALUES ($1, $2) ON CONFLICT (seed_hash) DO NOTHING',
      [hash, seed]
    );

    // Store in memory for quick access
    this.serverSeeds.set(userId, { seed, hash, revealed: false });

    return hash;
  }

  async getServerSeedHash(userId: number): Promise<string | null> {
    const cached = this.serverSeeds.get(userId);
    if (cached) return cached.hash;

    // Check database for unrevealed seed
    const res = await query(
      'SELECT seed_hash FROM server_seeds WHERE revealed_at IS NULL ORDER BY created_at DESC LIMIT 1'
    );
    return res.rows[0]?.seed_hash || null;
  }

  async revealServerSeed(userId: number): Promise<string | null> {
    const cached = this.serverSeeds.get(userId);
    if (cached && !cached.revealed) {
      cached.revealed = true;
      await query('UPDATE server_seeds SET revealed_at = NOW() WHERE seed_hash = $1', [cached.hash]);
      return cached.seed;
    }
    return null;
  }

  async placeBet(
    userId: number,
    gameId: string,
    betAmount: number,
    clientSeed: string,
    gameData: Record<string, any>
  ): Promise<{ session: GameSession; result: GameResult; newBalance: number }> {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Get user and lock balance
      const userRes = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [userId]);
      const user = userRes.rows[0];
      if (!user) throw new Error('User not found');
      if (user.is_banned) throw new Error('User is banned');
      if (user.balance < betAmount) throw new Error('Insufficient balance');

      // Get game config
      const gameRes = await client.query('SELECT * FROM games WHERE id = $1 AND is_active = TRUE', [gameId]);
      const game = gameRes.rows[0];
      if (!game) throw new Error('Game not found');
      if (betAmount < game.min_bet || betAmount > game.max_bet) {
        throw new Error(`Bet must be between ${game.min_bet} and ${game.max_bet}`);
      }

      // Get or generate server seed
      let serverSeedHash = await this.getServerSeedHash(userId);
      if (!serverSeedHash) {
        serverSeedHash = await this.generateServerSeed(userId);
      }

      // Get next nonce
      const nonceRes = await client.query(
        'SELECT COALESCE(MAX(nonce), 0) + 1 as next_nonce FROM game_sessions WHERE user_id = $1',
        [userId]
      );
      const nonce = nonceRes.rows[0].next_nonce;

      // Get server seed
      const seedRes = await client.query(
        'SELECT seed FROM server_seeds WHERE seed_hash = $1 AND revealed_at IS NULL',
        [serverSeedHash]
      );
      const serverSeed = seedRes.rows[0]?.seed;
      if (!serverSeed) throw new Error('Server seed not found');

      // Create PF engine with server seed
      const pfEngine = new ProvablyFairEngine(serverSeed);

      // Play the game
      let result: GameResult;
      switch (gameId) {
        case 'dice':
          result = pfEngine.dice(clientSeed, nonce, gameData.target, gameData.condition);
          break;
        case 'coinflip':
          result = pfEngine.coinflip(clientSeed, nonce, gameData.choice);
          break;
        case 'slots':
          result = pfEngine.slots(clientSeed, nonce);
          break;
        case 'crash':
          result = pfEngine.crash(clientSeed, nonce);
          break;
        case 'plinko':
          result = pfEngine.plinko(clientSeed, nonce, game.config?.rows || 16, gameData.risk || 'medium');
          break;
        case 'mines':
          result = pfEngine.mines(
            clientSeed, 
            nonce, 
            game.config?.grid_size || 5, 
            gameData.mines || 3, 
            gameData.clicks || []
          );
          break;
        default:
          throw new Error('Unknown game');
      }

      const payout = result.isWin ? Math.floor(betAmount * result.multiplier) : 0;
      const newBalance = user.balance - betAmount + payout;

      // Update user balance
      await client.query(
        'UPDATE users SET balance = $1, total_wagered = total_wagered + $2, total_won = total_won + $3, games_played = games_played + 1 WHERE id = $4',
        [newBalance, betAmount, payout, userId]
      );

      // Record game session
      const sessionRes = await client.query(
        `INSERT INTO game_sessions (user_id, game_id, bet_amount, result, payout, is_win, server_seed, client_seed, nonce)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [userId, gameId, betAmount, JSON.stringify(result.details), payout, result.isWin, serverSeed, clientSeed, nonce]
      );

      // Record bet transaction
      await client.query(
        `INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, game_session_id, description)
         VALUES ($1, 'bet', $2, $3, $4, $5, $6)`,
        [userId, -betAmount, user.balance, user.balance - betAmount, sessionRes.rows[0].id, `Bet on ${game.name}`]
      );

      // Record win transaction if won
      if (payout > 0) {
        await client.query(
          `INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, game_session_id, description)
           VALUES ($1, 'win', $2, $3, $4, $5, $6)`,
          [userId, payout, user.balance - betAmount, newBalance, sessionRes.rows[0].id, `Win on ${game.name}`]
        );
      }

      // Update daily stats
      await client.query(
        `INSERT INTO daily_stats (date, total_bets, total_wins, total_wagered, total_payout, house_profit, games_played)
         VALUES (CURRENT_DATE, 1, $1, $2, $3, $4, 1)
         ON CONFLICT (date) DO UPDATE SET
           total_bets = daily_stats.total_bets + 1,
           total_wins = daily_stats.total_wins + $1,
           total_wagered = daily_stats.total_wagered + $2,
           total_payout = daily_stats.total_payout + $3,
           house_profit = daily_stats.house_profit + $4,
           games_played = daily_stats.games_played + 1`,
        [result.isWin ? 1 : 0, betAmount, payout, betAmount - payout]
      );

      await client.query('COMMIT');

      return {
        session: sessionRes.rows[0],
        result: { ...result, payout },
        newBalance,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getGameHistory(userId: number, limit: number = 50, offset: number = 0): Promise<GameSession[]> {
    const res = await query(
      'SELECT * FROM game_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset]
    );
    return res.rows as GameSession[];
  }

  async getUserStats(userId: number) {
    const res = await query(
      `SELECT 
        u.balance,
        u.total_wagered,
        u.total_won,
        u.games_played,
        u.created_at,
        COALESCE(SUM(CASE WHEN gs.is_win THEN 1 ELSE 0 END), 0) as wins,
        COALESCE(SUM(CASE WHEN gs.is_win THEN gs.payout ELSE 0 END), 0) as total_winnings
       FROM users u
       LEFT JOIN game_sessions gs ON gs.user_id = u.id
       WHERE u.id = $1
       GROUP BY u.id`,
      [userId]
    );
    return res.rows[0];
  }

  async getLeaderboard(limit: number = 10): Promise<Array<{ user_id: number; username: string; balance: number; total_won: number; games_played: number }>> {
    const res = await query(
      `SELECT id as user_id, username, balance, total_won, games_played
       FROM users
       WHERE is_banned = FALSE AND id != 361695664
       ORDER BY total_won DESC
       LIMIT $1`,
      [limit]
    );
    return res.rows;
  }

  async verifyGame(sessionId: number, userId: number): Promise<{ verified: boolean; result: GameResult } | null> {
    const res = await query(
      'SELECT * FROM game_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (!res.rows[0]) return null;

    const session = res.rows[0];
    const pfEngine = new ProvablyFairEngine(session.server_seed);
    const verification = pfEngine.generateResult(session.client_seed, session.nonce);

    // Compare hashes
    const verified = verification.hash === session.result?.hash;

    return { verified, result: session.result };
  }
}

export const gameService = new GameService();