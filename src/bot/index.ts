import 'dotenv/config';
import { Telegraf, Context, Markup, session } from 'telegraf';
import { config } from '../config';
import { gameService } from '../games/game-service';
import { initSchema } from '../database';
import { ProvablyFairEngine } from '../games/provably-fair';

// Extend Telegraf Context
interface BotContext extends Context {
  session: {
    userId?: number;
    gameState?: any;
    clientSeed?: string;
  };
  userId?: number;
}

const bot = new Telegraf<BotContext>(config.BOT_TOKEN);

// Session middleware
bot.use(session());

// User middleware
bot.use(async (ctx, next) => {
  if (ctx.from) {
    ctx.userId = ctx.from.id;
    const user = await gameService.getOrCreateUser(
      ctx.from.id,
      ctx.from.username,
      ctx.from.first_name,
      ctx.from.last_name,
      ctx.from.language_code
    );
    // Initialize session if not exists
    if (!ctx.session) {
      ctx.session = { userId: undefined, gameState: undefined, clientSeed: undefined };
    }
    ctx.session.userId = ctx.from.id;
  }
  return next();
});

// Admin check
function isAdmin(ctx: BotContext): boolean {
  return config.OWNER_TELEGRAM_IDS.includes(ctx.from?.id.toString() || '');
}

// Main menu keyboard
const mainMenuKeyboard = Markup.keyboard([
  ['🎮 Play Games', '💰 Balance'],
  ['📊 Stats', '🏆 Leaderboard'],
  ['🎁 Bonus', '⚙️ Settings'],
  ['ℹ️ Help', '👤 Profile'],
]).resize().oneTime();

// Admin keyboard
const adminKeyboard = Markup.keyboard([
  ['📈 Admin Stats', '👥 Users'],
  ['💰 Adjust Balance', '📢 Broadcast'],
  ['⬅️ Back to Menu'],
]).resize().oneTime();

// Game selection keyboard
const gameKeyboard = Markup.inlineKeyboard([
  [Markup.button.webApp('🎲 Dice', `${config.WEBAPP_URL}/dice`), Markup.button.webApp('🪙 Coin Flip', `${config.WEBAPP_URL}/coinflip`)],
  [Markup.button.webApp('🎰 Slots', `${config.WEBAPP_URL}/slots`), Markup.button.webApp('📈 Crash', `${config.WEBAPP_URL}/crash`)],
  [Markup.button.webApp('🎯 Plinko', `${config.WEBAPP_URL}/plinko`), Markup.button.webApp('💣 Mines', `${config.WEBAPP_URL}/mines`)],
  [Markup.button.callback('🔙 Back', 'main_menu')],
]);

// Start command
bot.start(async (ctx) => {
  const user = await gameService.getOrCreateUser(
    ctx.from!.id,
    ctx.from!.username,
    ctx.from!.first_name,
    ctx.from!.last_name,
    ctx.from!.language_code
  );

  const welcomeMessage = `
🎰 <b>Welcome to Ethio Auto Casino!</b> 🎰

Hey ${ctx.from!.first_name}! Ready to play?

💰 <b>Your Balance:</b> ${(user.balance / 100).toFixed(2)} ETB
🎮 <b>Games Played:</b> ${user.games_played}
🏆 <b>Total Won:</b> ${(user.total_won / 100).toFixed(2)} ETB

Choose a game below or use the menu:
  `.trim();

  await ctx.replyWithHTML(welcomeMessage, gameKeyboard);
});

// Main menu
bot.hears('🎮 Play Games', async (ctx) => {
  await ctx.replyWithHTML('🎮 <b>Choose Your Game:</b>', gameKeyboard);
});

bot.hears('💰 Balance', async (ctx) => {
  const stats = await gameService.getUserStats(ctx.userId!);
  await ctx.replyWithHTML(`
💰 <b>Your Balance</b>

💵 Current: <b>${(stats.balance / 100).toFixed(2)} ETB</b>
🎮 Games Played: ${stats.games_played}
💸 Total Wagered: ${(stats.total_wagered / 100).toFixed(2)} ETB
🏆 Total Won: ${(stats.total_won / 100).toFixed(2)} ETB
  `.trim());
});

bot.hears('📊 Stats', async (ctx) => {
  const stats = await gameService.getUserStats(ctx.userId!);
  const winRate = stats.games_played > 0 ? ((stats.wins / stats.games_played) * 100).toFixed(1) : '0.0';

  await ctx.replyWithHTML(`
📊 <b>Your Statistics</b>

🎮 Games Played: ${stats.games_played}
✅ Wins: ${stats.wins}
📈 Win Rate: ${winRate}%
💸 Total Wagered: ${(stats.total_wagered / 100).toFixed(2)} ETB
🏆 Total Won: ${(stats.total_winnings / 100).toFixed(2)} ETB
💰 Net: ${((stats.total_winnings - stats.total_wagered) / 100).toFixed(2)} ETB
  `.trim());
});

bot.hears('🏆 Leaderboard', async (ctx) => {
  const leaderboard = await gameService.getLeaderboard(10);
  let msg = '🏆 <b>Top Winners</b>\n\n';
  leaderboard.forEach((user, i) => {
    msg += `${i + 1}. @${user.username || 'Anonymous'} - ${(user.total_won / 100).toFixed(2)} ETB\n`;
  });
  await ctx.replyWithHTML(msg);
});

bot.hears('👤 Profile', async (ctx) => {
  const stats = await gameService.getUserStats(ctx.userId!);
  await ctx.replyWithHTML(`
👤 <b>Your Profile</b>

🆔 ID: <code>${ctx.userId}</code>
👤 Name: ${ctx.from!.first_name} ${ctx.from!.last_name || ''}
🌐 Language: ${ctx.from!.language_code || 'en'}
📅 Joined: ${new Date(stats.created_at).toLocaleDateString()}
💰 Balance: ${(stats.balance / 100).toFixed(2)} ETB
  `.trim());
});

// Provably fair verification
bot.hears('🔍 Verify Game', async (ctx) => {
  await ctx.replyWithHTML(`
🔍 <b>Provably Fair Verification</b>

Every game is provably fair! You can verify any game result:

1. Play a game in the Mini App
2. After the game, you'll receive a <b>Server Seed Hash</b>
3. Request the server seed to be revealed
4. Use the verification tool to confirm the result wasn't manipulated

<i>Coming soon: In-app verification tool</i>
  `.trim());
});

// Admin commands
bot.hears('⚙️ Settings', async (ctx) => {
  if (!isAdmin(ctx)) return;
  await ctx.replyWithHTML('⚙️ <b>Admin Panel</b>', adminKeyboard);
});

bot.hears('📈 Admin Stats', async (ctx) => {
  if (!isAdmin(ctx)) return;
  const { query } = await import('../database/index.js');
  const res = await query(`SELECT * FROM daily_stats ORDER BY date DESC LIMIT 7`);
  let msg = '📈 <b>Last 7 Days Stats</b>\n\n';
  res.rows.forEach((day: any) => {
    msg += `${day.date}: ${day.active_users} active, ${day.games_played} games, ${(day.house_profit / 100).toFixed(2)} ETB profit\n`;
  });
  await ctx.replyWithHTML(msg);
});

bot.hears('⬅️ Back to Menu', async (ctx) => {
  await ctx.replyWithHTML('🏠 <b>Main Menu</b>', mainMenuKeyboard);
});

// WebApp data handler (when user interacts with Mini App)
bot.on('web_app_data', async (ctx) => {
  try {
    const webAppData = ctx.message && 'web_app_data' in ctx.message ? ctx.message.web_app_data : null;
    if (!webAppData) return;
    const data = JSON.parse(webAppData.data);
    console.log('📱 WebApp data received:', data);

    if (data.action === 'play_game') {
      // Game was played in Mini App, result sent back
      await ctx.replyWithHTML(`
🎮 <b>Game Result</b>

${data.result.isWin ? '🎉 <b>YOU WON!</b>' : '😢 Better luck next time!'}
💰 Payout: ${(data.result.payout / 100).toFixed(2)} ETB
💵 New Balance: ${(data.newBalance / 100).toFixed(2)} ETB
      `.trim());
    }
  } catch (error) {
    console.error('WebApp data error:', error);
  }
});

// Help command
bot.hears('ℹ️ Help', async (ctx) => {
  await ctx.replyWithHTML(`
ℹ️ <b>Help & Info</b>

🎮 <b>Games Available:</b>
• 🎲 Dice - Roll under/over target
• 🪙 Coin Flip - 50/50 chance
• 🎰 Slots - 3-reel classic
• 📈 Crash - Cash out before crash!
• 🎯 Plinko - Drop the ball
• 💣 Mines - Avoid the mines!

✅ <b>Provably Fair:</b> All games use cryptographic verification
💰 <b>Currency:</b> ETB (Ethiopian Birr)
🎁 <b>Daily Bonus:</b> Claim free coins daily!

📞 <b>Support:</b> Contact @ethioautocasino
  `.trim());
});

// Error handling
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply('❌ Something went wrong. Please try again.').catch(console.error);
});

// Launch
async function startBot() {
  try {
    // Initialize database
    await initSchema();
    console.log('✅ Database initialized');

    // Start bot
    if (config.NODE_ENV === 'production' && config.WEBAPP_URL) {
      // Webhook mode for production
      await bot.telegram.setWebhook(`${config.WEBAPP_URL}/webhook`);
      console.log('✅ Webhook set');
    } else {
      // Polling mode for development - delete any existing webhook first
      try {
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        console.log('🗑️ Deleted existing webhook');
      } catch (err: any) {
        // Ignore 404 if no webhook was set
        if (err.response?.error_code !== 404) throw err;
        console.log('🗑️ No webhook to delete');
      }
      await bot.launch();
      console.log('✅ Bot started in polling mode');
    }

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));

    // Keep process alive
    console.log('🤖 Bot is running... Press Ctrl+C to stop');
    await new Promise(() => {}); // Never resolves - keeps process alive

  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

startBot();

export { bot };