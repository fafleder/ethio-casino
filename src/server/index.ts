import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { bot } from '../bot';
import { gameService } from '../games/game-service';
import { config } from '../config';
import { ProvablyFairEngine } from '../games/provably-fair';
import crypto from 'crypto';

const app = express();
app.use(express.json());

// Validate Telegram WebApp initData
function validateInitData(initData: string): { valid: boolean; user?: any } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');
    
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(config.BOT_TOKEN).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    
    if (calculatedHash !== hash) {
      return { valid: false };
    }
    
    // Check auth_date is recent (within 24 hours)
    const authDate = parseInt(params.get('auth_date') || '0');
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) {
      return { valid: false };
    }
    
    const userParam = params.get('user');
    const user = userParam ? JSON.parse(userParam) : undefined;
    
    return { valid: true, user };
  } catch (error) {
    console.error('InitData validation error:', error);
    return { valid: false };
  }
}

// Middleware to authenticate Mini App requests
const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const initData = req.headers['x-telegram-init-data'] as string;
  
  if (!initData) {
    return res.status(401).json({ error: 'Missing init data' });
  }
  
  const { valid, user } = validateInitData(initData);
  if (!valid || !user) {
    return res.status(401).json({ error: 'Invalid init data' });
  }
  
  (req as any).telegramUser = user;
  (req as any).initData = initData;
  next();
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Telegram webhook endpoint - MUST BE BEFORE static files
app.post('/webhook', async (req: Request, res: Response) => {
  try {
    console.log('Webhook received:', JSON.stringify(req.body).substring(0, 200));
    await bot.handleUpdate(req.body);
    res.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// API Routes (with auth)
app.get('/api/games', authMiddleware, async (req, res) => {
  try {
    const games = await gameService.getGames();
    res.json({ games });
  } catch (error) {
    console.error('Get games error:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

app.get('/api/user/balance', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).telegramUser.id;
    const balance = await gameService.getUserBalance(userId);
    res.json({ balance });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

app.get('/api/user/stats', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).telegramUser.id;
    const stats = await gameService.getUserStats(userId);
    res.json({ stats });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.get('/api/user/history', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).telegramUser.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const gameId = req.query.game as string;
    const type = req.query.type as string;
    
    let query = 'SELECT * FROM game_sessions WHERE user_id = $1';
    const params: any[] = [userId];
    let paramIndex = 2;
    
    if (gameId) {
      query += ` AND game_id = $${paramIndex++}`;
      params.push(gameId);
    }
    
    if (type === 'win') {
      query += ` AND is_win = TRUE`;
    } else if (type === 'loss') {
      query += ` AND is_win = FALSE`;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);
    
    const { query: queryFn } = await import('../database/index.js');
    const result = await queryFn(query, params);
    
    res.json({ history: result.rows });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

app.get('/api/leaderboard', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const leaderboard = await gameService.getLeaderboard(limit);
    res.json({ leaderboard });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Generate server seed hash
app.post('/api/game/seed', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).telegramUser.id;
    const seedHash = await gameService.generateServerSeed(userId);
    res.json({ seedHash });
  } catch (error) {
    console.error('Generate seed error:', error);
    res.status(500).json({ error: 'Failed to generate seed' });
  }
});

// Play a game
app.post('/api/game/play', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).telegramUser.id;
    const { game_id, bet_amount, client_seed, game_data } = req.body;
    
    if (!game_id || !bet_amount || !client_seed) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const result = await gameService.placeBet(userId, game_id, bet_amount, client_seed, game_data || {});
    
    res.json({
      session: result.session,
      result: result.result,
      newBalance: result.newBalance
    });
  } catch (error: any) {
    console.error('Play game error:', error);
    res.status(400).json({ error: error.message || 'Failed to play game' });
  }
});

// Verify game result
app.post('/api/game/verify', authMiddleware, async (req, res) => {
  try {
    const { server_seed, client_seed, nonce } = req.body;
    
    if (!server_seed || !client_seed || nonce === undefined) {
      return res.status(400).json({ error: 'Missing verification parameters' });
    }
    
    const pfEngine = new ProvablyFairEngine(server_seed);
    const result = pfEngine.generateResult(client_seed, nonce);
    
    res.json({
      verified: true,
      result: result.result,
      hash: result.hash
    });
  } catch (error) {
    console.error('Verify game error:', error);
    res.status(500).json({ error: 'Failed to verify game' });
  }
});

// Claim daily bonus
app.post('/api/bonus/daily', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).telegramUser.id;
    const { query: queryFn } = await import('../database/index.js');
    
    // Check if already claimed today
    const lastClaim = await queryFn(
      `SELECT created_at FROM transactions 
       WHERE user_id = $1 AND type = 'bonus' 
       AND created_at > CURRENT_DATE 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    
    if (lastClaim.rows.length > 0) {
      return res.status(400).json({ error: 'Daily bonus already claimed' });
    }
    
    // Get user
    const userResult = await queryFn('SELECT balance FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Calculate bonus
    const bonusAmount = 10000; // 100 ETB
    const newBalance = user.balance + bonusAmount;
    
    await queryFn('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, userId]);
    await queryFn(
      `INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, description)
       VALUES ($1, 'bonus', $2, $3, $4, 'Daily login bonus')`,
      [userId, bonusAmount, user.balance, newBalance]
    );
    
    res.json({ bonus: bonusAmount, newBalance });
  } catch (error) {
    console.error('Claim bonus error:', error);
    res.status(500).json({ error: 'Failed to claim bonus' });
  }
});

// Serve Mini App static files (in production, or when built files exist)
import * as fs from 'fs';
import * as path from 'path';

const miniAppPath = path.join(process.cwd(), 'dist/miniapp');
const hasBuiltFiles = fs.existsSync(path.join(miniAppPath, 'index.html'));

if (config.NODE_ENV === 'production' || hasBuiltFiles) {
  // Static files only for GET requests
  app.use((req, res, next) => {
    if (req.method === 'GET') {
      express.static(miniAppPath)(req, res, () => {});
    } else {
      // Allow POST/other methods to pass through
    }
  });
  
  // Catch-all for Mini App (must be after webhook and API routes)
  app.get('*', (req, res) => {
    res.sendFile('index.html', { root: miniAppPath });
  });
} else {
  // Development fallback - show API info
  app.get('/', (req, res) => {
    res.json({ 
      message: 'Ethio Casino API Server',
      status: 'running',
      miniApp: 'Run `npm run build` to serve Mini App',
      endpoints: ['/health', '/api/games', '/webhook']
    });
  });
}

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = config.PORT;
app.listen(PORT, () => {
  console.log(`🚀 API Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${config.NODE_ENV}`);
});

export { app };