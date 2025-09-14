import dotenv from 'dotenv';
import { z } from 'zod';

// load .env file into process.env
dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  BASE_URL: z.string().url({ message: 'BASE_URL must be a valid URL' }),
});

export const env = schema.parse(process.env);
