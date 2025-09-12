import { z } from 'zod';

const envSchema = z.object({
  // Telegram
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN is required'),

  // Redis
  UPSTASH_REDIS_REST_URL: z.string().url('UPSTASH_REDIS_REST_URL must be a valid URL'),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1, 'UPSTASH_REDIS_REST_TOKEN is required'),

  // Scanner
  BASE_URL: z.string().min(1, 'BASE_URL is required'),
  ITEMS_CGI_VER: z.string().min(1, 'ITEMS_CGI_VER is required'),
  ITEMS_CGI_PATH_TEMPLATE: z.string().min(1, 'ITEMS_CGI_PATH_TEMPLATE is required'),

  // Deployment
  WEBHOOK_SECRET: z.string().optional(),
});

export const env = envSchema.parse(process.env);
