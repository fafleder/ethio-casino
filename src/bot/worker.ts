// Worker entry point for background tasks
// This runs as a separate service on Northflank for cron jobs, notifications, etc.

import 'dotenv/config';
import { config } from '../config';
import { cronScheduler } from '../services/cron-scheduler';
import { notificationService } from '../services/notification-service';
import { gameService } from '../games/game-service';
import { db } from '../database';

async function startWorker() {
  console.log('🔧 Starting Ethio Casino Worker...');
  console.log(`Environment: ${config.NODE_ENV}`);

  // Initialize database
  try {
    await db.connect();
    console.log('✅ Database connected');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }

  // Start cron scheduler for automated tasks
  cronScheduler.start();

  // Schedule daily bonus reminders (every hour, check for eligible users)
  cronScheduler.schedule('daily-bonus-reminder', '0 * * * *', async () => {
    try {
      const users = await gameService.getUsersEligibleForDailyBonus();
      for (const user of users) {
        await notificationService.sendDailyBonusReminder(user.telegram_id);
      }
      console.log(`📢 Sent daily bonus reminders to ${users.length} users`);
    } catch (error) {
      console.error('Daily bonus reminder error:', error);
    }
  });

  // Schedule leaderboard updates (every 15 minutes)
  cronScheduler.schedule('leaderboard-update', '*/15 * * * *', async () => {
    try {
      await gameService.refreshLeaderboardCache();
      console.log('📊 Leaderboard cache refreshed');
    } catch (error) {
      console.error('Leaderboard update error:', error);
    }
  });

  // Schedule database cleanup (daily at 3 AM)
  cronScheduler.schedule('db-cleanup', '0 3 * * *', async () => {
    try {
      await gameService.cleanupOldSessions(30); // Keep 30 days
      console.log('🧹 Database cleanup completed');
    } catch (error) {
      console.error('DB cleanup error:', error);
    }
  });

  // Schedule seed rotation (weekly on Sunday at 2 AM)
  cronScheduler.schedule('seed-rotation', '0 2 * * 0', async () => {
    try {
      await gameService.rotateServerSeeds();
      console.log('🔐 Server seeds rotated');
    } catch (error) {
      console.error('Seed rotation error:', error);
    }
  });

  console.log('✅ Worker started with cron jobs:');
  console.log('  - daily-bonus-reminder: hourly');
  console.log('  - leaderboard-update: every 15 minutes');
  console.log('  - db-cleanup: daily at 3 AM');
  console.log('  - seed-rotation: weekly on Sunday at 2 AM');

  // Keep process alive
  process.on('SIGINT', async () => {
    console.log('🛑 Shutting down worker...');
    cronScheduler.stop();
    await db.disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('🛑 Shutting down worker...');
    cronScheduler.stop();
    await db.disconnect();
    process.exit(0);
  });
}

// Handle unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

startWorker();