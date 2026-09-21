// Cloudflare Worker for Ethio Casino Telegram Bot
// Deploys to Cloudflare Workers free tier (100K requests/day)

import { Bot, Context, session, SessionFlavor } from "telegraf";
import { ProvablyFairEngine } from "./games/provably-fair";
import { gameService } from "./games/game-service";
import { config } from "./config";

// Extend Telegraf context with session
interface SessionData {
  userId?: number;
  step?: string;
  data?: Record<string, unknown>;
}
type MyContext = Context & SessionFlavor<SessionData>;

// Bot instance
const bot = new MyContext(config.BOT_TOKEN);

// Middleware for Mini App initData validation
function validateInitData(initData: string): { valid: boolean; user?: any } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const encoder = new TextEncoder();
    const secretKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode('WebAppData'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const botTokenKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(config.BOT_TOKEN),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const secret = await crypto.subtle.sign('HMAC', secretKey, encoder.encode(config.BOT_TOKEN));
    const calculatedHash = await crypto.subtle.sign('HMAC', botTokenKey, encoder.encode(dataCheckString));

    if (bytesToHex(new Uint8Array(calculatedHash)) !== hash) {
      return { valid: false };
    }

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

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Webhook handler
export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    // Set config from environment
    config.BOT_TOKEN = env.BOT_TOKEN;
    config.NODE_ENV = env.NODE_ENV || 'production';
    config.WEBAPP_URL = env.WEBAPP_URL;

    const url = new URL(request.url);
    const path = url.pathname;

    // Health check
    if (path === '/health') {
      return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Telegram webhook endpoint
    if (path === '/webhook' && request.method === 'POST') {
      try {
        const update = await request.json();
        await bot.handleUpdate(update);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('Webhook error:', error);
        return new Response(JSON.stringify({ error: 'Webhook processing failed' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Mini App API routes (with auth)
    if (path.startsWith('/api/')) {
      const initData = request.headers.get('x-telegram-init-data');
      if (!initData) {
        return new Response(JSON.stringify({ error: 'Missing init data' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const { valid, user } = await validateInitData(initData);
      if (!valid || !user) {
        return new Response(JSON.stringify({ error: 'Invalid init data' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Route to appropriate handler
      if (path === '/api/games' && request.method === 'GET') {
        const games = await gameService.getGames();
        return new Response(JSON.stringify({ games }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/api/user/balance' && request.method === 'GET') {
        const balance = await gameService.getUserBalance(user.id);
        return new Response(JSON.stringify({ balance }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/api/user/stats' && request.method === 'GET') {
        const stats = await gameService.getUserStats(user.id);
        return new Response(JSON.stringify({ stats }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/api/user/history' && request.method === 'GET') {
        const urlParams = new URL(request.url).searchParams;
        const limit = parseInt(urlParams.get('limit') || '50');
        const offset = parseInt(urlParams.get('offset') || '0');
        const gameId = urlParams.get('game');
        const type = urlParams.get('type');
        const history = await gameService.getUserHistory(user.id, limit, offset, gameId, type);
        return new Response(JSON.stringify({ history }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/api/leaderboard' && request.method === 'GET') {
        const urlParams = new URL(request.url).searchParams;
        const limit = parseInt(urlParams.get('limit') || '10');
        const leaderboard = await gameService.getLeaderboard(limit);
        return new Response(JSON.stringify({ leaderboard }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/api/game/seed' && request.method === 'POST') {
        const seedHash = await gameService.generateServerSeed(user.id);
        return new Response(JSON.stringify({ seedHash }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/api/game/play' && request.method === 'POST') {
        const body = await request.json();
        const { game_id, bet_amount, client_seed, game_data } = body;
        if (!game_id || !bet_amount || !client_seed) {
          return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        const result = await gameService.placeBet(user.id, game_id, bet_amount, client_seed, game_data || {});
        return new Response(JSON.stringify({
          session: result.session,
          result: result.result,
          newBalance: result.newBalance,
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/api/game/verify' && request.method === 'POST') {
        const body = await request.json();
        const { server_seed, client_seed, nonce } = body;
        if (!server_seed || !client_seed || nonce === undefined) {
          return new Response(JSON.stringify({ error: 'Missing verification parameters' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        const pfEngine = new ProvablyFairEngine(server_seed);
        const result = pfEngine.generateResult(client_seed, nonce);
        return new Response(JSON.stringify({
          verified: true,
          result: result.result,
          hash: result.hash,
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/api/bonus/daily' && request.method === 'POST') {
        const result = await gameService.claimDailyBonus(user.id);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 404 for everything else
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};

// Bot command handlers
bot.command('start', async (ctx: MyContext) => {
  const user = ctx.from;
  if (!user) return;

  // Create or get user
  await gameService.getOrCreateUser(user.id, user.username, user.first_name, user.last_name);

  await ctx.reply(
    `🎰 Welcome to Ethio Casino, ${user.first_name}!\n\n` +
    `Play provably fair games:\n` +
    `🎲 Dice | 🪙 Coin Flip | 🎰 Slots\n` +
    `🚀 Crash | 📉 Plinko | 💣 Mines\n\n` +
    `Claim daily bonus every 24 hours!\n\n` +
    `Click below to open the Mini App:`,
    {
      reply_markup: {
        inline_keyboard: [[
          { text: '🎮 Play Games', web_app: { url: config.WEBAPP_URL } },
        ]],
      },
    }
  );
});

bot.command('balance', async (ctx: MyContext) => {
  const user = ctx.from;
  if (!user) return;
  const balance = await gameService.getUserBalance(user.id);
  await ctx.reply(`💰 Your balance: ${balance} ETB`);
});

bot.command('leaderboard', async (ctx: MyContext) => {
  const leaderboard = await gameService.getLeaderboard(10);
  let msg = '🏆 Leaderboard:\n\n';
  leaderboard.forEach((entry, i) => {
    msg += `${i + 1}. ${entry.username || entry.user_id} - ${entry.balance} ETB\n`;
  });
  await ctx.reply(msg);
});

bot.command('daily', async (ctx: MyContext) => {
  const user = ctx.from;
  if (!user) return;
  try {
    const result = await gameService.claimDailyBonus(user.id);
    await ctx.reply(`🎁 Daily bonus claimed! +${result.bonus} ETB\nNew balance: ${result.newBalance} ETB`);
  } catch (error: any) {
    await ctx.reply(error.message || 'Failed to claim bonus');
  }
});