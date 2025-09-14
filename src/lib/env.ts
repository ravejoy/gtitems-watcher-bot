import { z } from 'zod';

const schema = z.object({
  BASE_URL: z.string().url(),
  TELEGRAM_BOT_TOKEN: z.string(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/**
 * Returns validated env. On first call:
 * - if `overrides` is provided, it will be used as the source
 * - otherwise, `process.env` is used
 * The result is cached until `resetEnv()` is called.
 */
export function getEnv(overrides?: Partial<NodeJS.ProcessEnv>): Env {
  if (cached) return cached;
  const source = overrides ?? process.env;
  cached = schema.parse(source);
  return cached;
}

/** Clears the cached env. Intended for tests. */
export function resetEnv(): void {
  cached = null;
}
