import { z } from 'zod';

export const configSchema = z.object({
  // Telegram Bot (required)
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN is required'),
  BOT_USERNAME: z.string().min(1, 'BOT_USERNAME is required'),
  WEBAPP_URL: z.string().url('WEBAPP_URL must be a valid URL').optional().default(''),

  // Database (required for production)
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // NVIDIA Nemotron 3 Ultra (optional)
  NVIDIA_API_KEY: z.string().optional().default(''),
  NVIDIA_BASE_URL: z.string().url().default('https://integrate.api.nvidia.com/v1'),

  // Admin
  OWNER_TELEGRAM_IDS: z.string().transform(s => s.split(',').map(s => s.trim()).filter(Boolean)).default('361695664'),

  // Server
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  const result = configSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid configuration:', result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();