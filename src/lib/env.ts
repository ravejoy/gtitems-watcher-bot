import dotenv from 'dotenv';
import { z } from 'zod';

// load .env file into process.env
dotenv.config();

const schema = z.object({
  BASE_URL: z.string().url(),
  TELEGRAM_BOT_TOKEN: z.string(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CONCURRENCY: z.coerce.number().int().min(1).max(20).default(6),
});

type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function getEnv(overrides?: Partial<NodeJS.ProcessEnv>): Env {
  if (cached) return cached;
  const source = overrides ?? process.env;
  cached = schema.parse(source);
  return cached;
}

export function resetEnv(): void {
  cached = null;
}
